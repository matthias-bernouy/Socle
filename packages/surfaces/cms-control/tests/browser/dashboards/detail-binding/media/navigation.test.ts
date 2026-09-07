import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { imageFile, installMediaRoutes, mediaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("an upload finishing after navigation cannot refresh a revisited detail or overwrite its new draft", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installMediaRoutes(page, bundle, styles);
        const release = fixture.holdAction();
        await page.goto(mediaPage);
        const request = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/uploadMedia"));
        const response = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/uploadMedia"));
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles(imageFile);
        await request;
        await page.evaluate(() => {
            const url = new URL(location.href);
            url.searchParams.set("row", "other");
            history.pushState({}, "", url);
            dispatchEvent(new PopStateEvent("popstate"));
        });
        await page.locator('cms-dashboard-w-detail[data-row-key="other"] textarea').waitFor();
        await page.goBack();
        const detail = page.locator('cms-dashboard-w-detail[data-row-key="quality-media"]');
        const notes = detail.locator('[data-field-control="notes"] textarea');
        await notes.fill("New draft after revisiting");
        const reads = fixture.requests.filter((path) => path.endsWith("/item")).length;
        expect(reads).toBe(3);
        release();
        await response;
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(reads);
            expect(await notes.inputValue()).toBe("New draft after revisiting");
            expect(await notes.evaluate((node) => node.matches(":focus"))).toBe(true);
        }
        expect(fixture.resource.photos).toHaveLength(4);
        expect(await detail.locator("[data-media-tile]").count()).toBe(3);
    } finally {
        await browser.close();
    }
}, 20_000);
