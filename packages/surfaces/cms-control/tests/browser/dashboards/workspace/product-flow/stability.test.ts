import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { productFixture, detailUrl } from "./fixture";

test("slow Save keeps focus, geometry and scroll, blocks double submits and input until the read finishes", async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 844 } });
            page.setDefaultTimeout(6000);
            const state = await productFixture(page);
            await page.goto(detailUrl);
            const title = page.locator('[data-detail-save] [name="title"] input');
            await title.fill("Slow save");
            const handle = await title.elementHandle();
            const before = await title.boundingBox();
            const reads = state.reads;
            state.saveDelay = 180;
            state.readDelay = 350;
            const start = performance.now();
            const request = page.waitForRequest("**/upsertProduct");
            await page.locator("[data-detail-save]").evaluate((node: HTMLFormElement) => node.requestSubmit());
            await request;
            await page.locator("[data-detail-save]").evaluate((node: HTMLFormElement) => node.requestSubmit());
            await page.keyboard.type("blocked");
            expect(await title.inputValue()).toBe("Slow save");
            expect(await title.boundingBox()).toEqual(before);
            await page.waitForFunction(
                () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
            );
            const elapsed = performance.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(500);
            expect(elapsed).toBeLessThan(2000);
            expect(state.reads).toBe(reads + 1);
            expect(state.writes).toHaveLength(1);
            expect(await handle!.evaluate((node) => node.isConnected)).toBe(true);
            expect(await title.boundingBox()).toEqual(before);
            expect(
                await title.evaluate(
                    (node) =>
                        node.getRootNode() instanceof ShadowRoot &&
                        (node.getRootNode() as ShadowRoot).activeElement === node,
                ),
            ).toBe(true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: `/tmp/cmscore-integration-view-step4/screens/slow-save-${width}.png` });
            expect(state.errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25000);

test("conflicts preserve edits and a failed post-save read retries without replaying or losing newer edits", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const state = await productFixture(page);
        await page.goto(detailUrl);
        const title = page.locator('[data-detail-save] [name="title"] input');
        await title.fill("Keep my draft");
        state.saveStatus = 409;
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.locator("[data-detail-save] p9r-alert").waitFor();
        expect(await title.inputValue()).toBe("Keep my draft");
        expect(state.reads).toBe(1);
        state.saveStatus = 204;
        state.readStatus = 503;
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        const retry = page.getByRole("button", { name: "Retry", exact: true });
        await retry.waitFor();
        await title.fill("Newer edit after read failure");
        state.readStatus = 200;
        await retry.click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(state.writes).toHaveLength(2);
        expect(await title.inputValue()).toBe("Newer edit after read failure");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "9",
        );
        expect(state.current.title).toBe("Newer edit after read failure");
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("saving from a scrolled lower field preserves every scroll container", async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 650 } });
            page.setDefaultTimeout(6000);
            const state = await productFixture(page);
            await page.goto(detailUrl);
            const lower = page.locator('[data-field-control="variantAxes"]');
            await lower.scrollIntoViewIfNeeded();
            const position = await page.evaluate(() => {
                const elements: Element[] = [];
                const visit = (root: Document | ShadowRoot) => {
                    for (const node of Array.from(root.querySelectorAll("*"))) {
                        if (node.scrollTop || node.scrollLeft) {
                            elements.push(node);
                        }
                        if (node.shadowRoot) {
                            visit(node.shadowRoot);
                        }
                    }
                };
                visit(document);
                (window as any).savedScrollElements = elements;
                return elements.map((node) => [node.scrollTop, node.scrollLeft]);
            });
            expect(position.length).toBeGreaterThan(0);
            const box = await lower.boundingBox();
            state.saveDelay = 150;
            state.readDelay = 150;
            await page.locator("[data-detail-save]").evaluate((form: HTMLFormElement) => form.requestSubmit());
            await page.waitForFunction(
                () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
            );
            expect(
                await page.evaluate(() =>
                    (window as any).savedScrollElements.map((node: Element) => [node.scrollTop, node.scrollLeft]),
                ),
            ).toEqual(position);
            expect(await lower.boundingBox()).toEqual(box);
            await page.screenshot({ path: `/tmp/cmscore-integration-view-step4/screens/scrolled-save-${width}.png` });
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 20000);
