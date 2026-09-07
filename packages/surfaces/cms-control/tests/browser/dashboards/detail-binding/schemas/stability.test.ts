import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { resolve } from "node:path";
import { installSchemaRoutes, schemaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("schema arrival preserves a draft and its selection in an existing field", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const fixture = await installSchemaRoutes(page, bundle, styles);
        const release = fixture.holdSchema();
        await page.goto(schemaPage);
        const notes = page.locator('[data-field-control="notes"] textarea');
        await notes.fill("Typing while schema loads");
        await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 7));
        const nav = await page.locator("cms-dashboards-nav").boundingBox();
        release();
        await page.locator('[data-schema-key="weight"] input').waitFor();
        expect(await state(notes)).toEqual(["Typing while schema loads", true, 2, 7]);
        expect(await page.locator("cms-dashboards-nav").boundingBox()).toEqual(nav);
        expect(fixture.schemas).toHaveLength(1);
    } finally {
        await browser.close();
    }
}, 15_000);

test("schema drafts survive detail refreshes and overlapping save edits without moving the scrolling pane", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
        page.setDefaultTimeout(5000);
        const fixture = await installSchemaRoutes(page, bundle, styles);
        await page.goto(schemaPage);
        const detail = page.locator("cms-dashboard-w-detail");
        const schema = page.locator('[data-field-control="metadata"]');
        const condition = schema.locator('[data-schema-key="condition"]');
        const serial = schema.locator('[data-schema-key="serial"] input');
        await condition.getByRole("combobox").click();
        const panel = condition.locator("[popover]");
        const boxAtBottom = await panel.boundingBox();
        expect(boxAtBottom!.y).toBeGreaterThanOrEqual(0);
        expect(boxAtBottom!.y + boxAtBottom!.height).toBeLessThanOrEqual(700);
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        const resized = await panel.boundingBox();
        expect(resized!.y + resized!.height).toBeLessThanOrEqual(1000);
        await page.setViewportSize({ width: 390, height: 700 });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        if (process.env.CMS_SCHEMA_DROPDOWN_CAPTURE) {
            await page.screenshot({ path: process.env.CMS_SCHEMA_DROPDOWN_CAPTURE, animations: "disabled" });
        }
        await condition.getByRole("option", { name: "Used", exact: true }).click();
        await serial.fill("First schema draft");
        const notes = page.locator('[data-field-control="notes"] textarea');
        await notes.fill("Keep the bottom draft");
        await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(1, 6));
        const main = page.locator("w13c-left-menu-layout main");
        const snapshot = async () => ({
            note: await state(notes),
            box: await notes.boundingBox(),
            scroll: await main.evaluate((node) => node.scrollTop),
            nav: await page.locator("w13c-left-menu-layout .mobile-toolbar").boundingBox(),
        });
        const before = await snapshot();
        expect(before.scroll).toBeGreaterThan(0);
        const releaseRead = fixture.hold();
        const requested = page.waitForRequest((request) => request.url().endsWith("/item"));
        const refreshed = page.waitForResponse((response) => response.url().endsWith("/item"));
        await detail.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
        await requested;
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await snapshot()).toEqual(before);
        }
        releaseRead();
        await refreshed;
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        expect(await snapshot()).toEqual(before);
        expect(await serial.inputValue()).toBe("First schema draft");
        expect(fixture.schemas).toHaveLength(1);

        const releaseSave = fixture.holdSave();
        const saving = page.waitForRequest((request) => request.url().endsWith("/save"));
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saving;
        await serial.fill("Newer schema draft");
        await serial.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 8));
        const box = await serial.boundingBox();
        const scroll = await main.evaluate((node) => node.scrollTop);
        releaseSave();
        await saved;
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await state(serial)).toEqual(["Newer schema draft", true, 2, 8]);
            expect(await serial.boundingBox()).toEqual(box);
            expect(await main.evaluate((node) => node.scrollTop)).toBe(scroll);
        }
        expect((fixture.saved[0]?.metadata as Record<string, unknown>).serial).toBe("First schema draft");
        const second = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await second;
        await page.reload();
        await serial.waitFor();
        expect(await serial.inputValue()).toBe("Newer schema draft");
        expect(await notes.inputValue()).toBe("Keep the bottom draft");
        expect(fixture.saved).toHaveLength(2);
    } finally {
        await browser.close();
    }
}, 25_000);

async function state(control: Locator) {
    return control.evaluate((node: HTMLInputElement | HTMLTextAreaElement) => [
        node.value,
        node.matches(":focus"),
        node.selectionStart,
        node.selectionEnd,
    ]);
}
