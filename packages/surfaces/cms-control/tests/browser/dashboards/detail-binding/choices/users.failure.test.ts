import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { aliceLabel, installUserRoutes } from "./users.fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("a delayed directory preserves a long-form draft, focus and scroll; errors retry once", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
        page.setDefaultTimeout(5000);
        const fixture = await installUserRoutes(page, bundle, styles, true, true);
        const release = fixture.hold();
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const notes = page.locator('[data-field-control="notes"] textarea');
        await notes.fill("Keep this long-form draft");
        await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 8));
        const content = page.locator("w13c-left-menu-layout main");
        const scroll = await content.evaluate((node) => node.scrollTop);
        expect(scroll).toBeGreaterThan(0);
        const nav = page.locator("cms-dashboards-nav");
        const navBox = await nav.boundingBox();
        const notesBox = await notes.boundingBox();
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await nav.boundingBox()).toEqual(navBox);
            expect(await notes.boundingBox()).toEqual(notesBox);
            expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
        }
        release();
        const user = page.locator('[data-field-control="user"]');
        await user.locator("option").filter({ hasText: aliceLabel }).waitFor({ state: "attached" });
        expect(await notes.inputValue()).toBe("Keep this long-form draft");
        expect(
            await notes.evaluate((node: HTMLTextAreaElement) => [
                (node.getRootNode() as ShadowRoot).activeElement === node,
                node.selectionStart,
                node.selectionEnd,
            ]),
        ).toEqual([true, 2, 8]);
        expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
        expect(fixture.reads()).toBe(1);
        fixture.fail();
        await page.reload();
        await page.waitForFunction(() =>
            document.querySelector('[data-field-control="user"]')?.getAttribute("hint")?.includes("Unable to load"),
        );
        expect(await user.getAttribute("invalid")).toBe("");
        expect(await page.locator('[data-field-control="reviewer"] input').inputValue()).toBe("missing:subject");
        await user.locator("input").click();
        await user.locator("option").filter({ hasText: aliceLabel }).waitFor({ state: "attached" });
        expect(fixture.reads()).toBe(3);
        expect(await user.getAttribute("invalid")).toBeNull();
        expect(await user.getAttribute("hint")).toBe("");
    } finally {
        await browser.close();
    }
}, 20_000);

test("directory completion preserves an open user search and its text selection", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installUserRoutes(page, bundle, styles, true);
        const release = fixture.hold();
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const user = page.locator('[data-field-control="user"]');
        const input = user.locator("input");
        await input.fill("Alice");
        await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 4));
        const box = await user.boundingBox();
        release();
        await user.getByRole("option", { name: aliceLabel, exact: true }).waitFor();
        expect(await input.inputValue()).toBe("Alice");
        expect(await input.getAttribute("aria-expanded")).toBe("true");
        expect(
            await input.evaluate((node: HTMLInputElement) => [
                (node.getRootNode() as ShadowRoot).activeElement === node,
                node.selectionStart,
                node.selectionEnd,
            ]),
        ).toEqual([true, 1, 4]);
        expect(await user.boundingBox()).toEqual(box);
        expect(fixture.reads()).toBe(1);
    } finally {
        await browser.close();
    }
}, 15_000);
