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

test("a failed media upload reports the error and can be retried after a persisted reload", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installMediaRoutes(page, bundle, styles);
        fixture.fail();
        await page.goto(mediaPage);
        const media = page.locator('[data-field-control="photos"]');
        const failed = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/uploadMedia"));
        const chooser = page.waitForEvent("filechooser");
        await media.getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles(imageFile);
        expect((await failed).status()).toBe(503);
        await page.getByText(/Media operation unavailable/).waitFor();
        expect(fixture.resource.photos.map((item) => item.id)).toEqual(["front", "side", "back"]);
        expect(fixture.calls).toHaveLength(1);
        await page.reload();
        await media.locator('[data-media-tile] img[alt="back view"]').waitFor();
        expect(await media.locator("[data-media-tile]").count()).toBe(3);
        const retryChooser = page.waitForEvent("filechooser");
        await media.getByRole("button", { name: "Add media", exact: true }).click();
        await (await retryChooser).setFiles(imageFile);
        await media.locator('[data-media-tile] img[src="/media/uploaded-1.svg"]').waitFor();
        expect(fixture.resource.photos).toHaveLength(4);
        expect(fixture.calls).toHaveLength(2);
        for (const call of fixture.calls) {
            expect(await call.files[0]!.text()).toBe(imageFile.buffer.toString());
        }
        await page.reload();
        await media.locator('[data-media-tile] img[src="/media/uploaded-1.svg"]').waitFor();
        expect(await media.locator("[data-media-tile]").count()).toBe(4);
    } finally {
        await browser.close();
    }
}, 20_000);
