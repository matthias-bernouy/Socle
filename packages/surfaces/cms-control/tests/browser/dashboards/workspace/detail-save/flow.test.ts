import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountSave } from "./fixture";

test("Save captures both columns, locks through the targeted GET and keeps mounted controls", async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const { state, errors } = await mountSave(page);
            state.saveDelay = 180;
            state.readDelay = 350;
            const title = page.locator('p9r-input[name="title"] input');
            await title.fill("Draft");
            await title.focus();
            const baseline = await page.evaluate(() => {
                const nodes = Array.from(
                    document.querySelectorAll("#save, p9r-input, p9r-token-input, w13c-switch, article"),
                );
                (window as any).savedNodes = nodes;
                return {
                    top: document.querySelector("cms-shell-detail-body")!.getBoundingClientRect().top,
                    scroll: scrollY,
                };
            });
            await page.locator("#save").evaluate((form: HTMLFormElement) => form.requestSubmit());
            await page.waitForFunction(() => document.querySelector("#detail")!.getAttribute("aria-busy") === "true");
            await page.keyboard.type("blocked");
            await page.locator("#save").evaluate((form: HTMLFormElement) => form.requestSubmit());
            expect(await title.inputValue()).toBe("Draft");
            expect(await page.locator('input[name="quantity"]').isDisabled()).toBe(false);
            await page.waitForFunction(
                () =>
                    document.querySelector('#operation input[name="expectedRevision"]')?.getAttribute("value") === "8",
            );
            await page.waitForFunction(() => !document.querySelector("#detail")!.hasAttribute("aria-busy"));
            expect(state.writes).toEqual([
                { id: "p1", expectedRevision: 7, title: "Draft", tags: "tennis,padel", quantity: 0, enabled: false },
            ]);
            expect([state.reads, state.otherReads]).toEqual([2, 1]);
            // The server normalizes back to its original title: old/new GET values are equal.
            expect(await title.inputValue()).toBe("Original");
            const final = await page.evaluate(() => ({
                stable: (window as any).savedNodes.every((node: Element) => node.isConnected),
                focused: document.activeElement?.localName,
                top: document.querySelector("cms-shell-detail-body")!.getBoundingClientRect().top,
                scroll: scrollY,
                overflow: document.documentElement.scrollWidth > innerWidth,
            }));
            expect(final).toEqual({ stable: true, focused: "p9r-input", ...baseline, overflow: false });
            if (process.env.CMS_SAVE_CAPTURES) {
                await page.screenshot({ path: `${process.env.CMS_SAVE_CAPTURES}/save-${width}.png`, fullPage: true });
            }
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 30000);

test("conflict keeps the draft; failed refresh retries only the read", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const { state, errors } = await mountSave(page);
        const title = page.locator('p9r-input[name="title"] input');
        await title.fill("Keep my draft");
        await page.evaluate(() => {
            (window as any).events = [];
            for (const name of ["cms-source:success", "cms-source:failed", "cms-source:refresh-failed"]) {
                document.addEventListener(name, () => (window as any).events.push(name));
            }
        });
        state.saveStatus = 409;
        await page.getByRole("button", { name: "Save product" }).click();
        await page.locator("#save-error").waitFor();
        expect(await title.inputValue()).toBe("Keep my draft");
        expect([state.reads, state.writes.length]).toEqual([1, 1]);
        state.saveStatus = 204;
        state.readStatus = 503;
        await page.getByRole("button", { name: "Save product" }).click();
        await page.locator("#refresh-error").waitFor();
        expect(await title.inputValue()).toBe("Keep my draft");
        expect(await page.locator("#detail").getAttribute("aria-busy")).toBeNull();
        state.readStatus = 200;
        await page
            .locator("#detail")
            .evaluate((source) => source.dispatchEvent(new CustomEvent("cms-source:reload", { bubbles: true })));
        await page.waitForFunction(
            () => document.querySelector('#operation input[name="expectedRevision"]')?.getAttribute("value") === "8",
        );
        expect([state.reads, state.writes.length, state.otherReads]).toEqual([3, 2, 1]);
        expect(await page.locator("#refresh-error").count()).toBe(0);
        expect(await page.evaluate(() => (window as any).events)).toEqual([
            "cms-source:failed",
            "cms-source:refresh-failed",
        ]);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 30000);
