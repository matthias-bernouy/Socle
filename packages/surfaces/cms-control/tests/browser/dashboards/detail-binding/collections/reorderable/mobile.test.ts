import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installReorderableRoutes, reorderablePage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("mobile choice failures retain bottom drafts, navigation, selection and scroll through retry", async () => {
    const browser = await chromium.launch();
    let release = () => {};
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
        page.setDefaultTimeout(5000);
        const fixture = await installReorderableRoutes(page, bundle, styles, "cards");
        const pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.route(
            "**/.cms/sources/store/save",
            async (route) => {
                await pending;
                await route.fulfill({ status: 503, json: { error: "Choice save unavailable" } });
            },
            { times: 1 },
        );
        await page.goto(reorderablePage);
        const axes = page.locator('[data-field-control="choices"]');
        await axes.locator('option[value="head"]').first().waitFor({ state: "attached" });
        const notes = page.locator('[data-field-control="notes"] textarea');
        const main = page.locator("w13c-left-menu-layout main");
        await notes.fill("Bottom draft before save");
        const saving = page.waitForRequest((request) => request.url().endsWith("/save"));
        const response = page.waitForResponse((value) => value.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saving;
        await notes.fill("Newer bottom draft");
        await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 8));
        const snapshot = async () => ({
            note: await notes.evaluate((node: HTMLTextAreaElement) => [
                node.value,
                node.matches(":focus"),
                node.selectionStart,
                node.selectionEnd,
            ]),
            box: await notes.boundingBox(),
            scroll: await main.evaluate((node) => node.scrollTop),
            nav: await page.locator("w13c-left-menu-layout .mobile-toolbar").boundingBox(),
        });
        const before = await snapshot();
        expect(before.scroll).toBeGreaterThan(0);
        release();
        expect((await response).status()).toBe(503);
        await page.getByText(/Choice save unavailable/).waitFor();
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await snapshot()).toEqual(before);
        }
        expect(fixture.resource.notes).toBe("Saved notes");
        const retry = page.waitForResponse((value) => value.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await retry;
        await page.reload();
        await notes.waitFor();
        expect(await notes.inputValue()).toBe("Newer bottom draft");
        expect(fixture.saved).toHaveLength(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
        release();
        await browser.close();
    }
}, 20_000);
