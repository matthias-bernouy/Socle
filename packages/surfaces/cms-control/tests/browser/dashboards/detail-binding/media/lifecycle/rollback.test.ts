import { expect, test } from "bun:test";
import { chromium, type Page, type Locator } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { imageFile, installMediaRoutes, mediaPage } from "../fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("failed media mutations restore the previous field and allow retry without losing another draft", async () => {
    const browser = await chromium.launch();
    const captures = process.env.CMS_MEDIA_RECOVERY_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const action of ["upload", "replace", "remove", "reorder"]) {
            const page = await browser.newPage();
            page.setDefaultTimeout(5000);
            const fixture = await installMediaRoutes(page, bundle, styles);
            fixture.fail();
            const release = fixture.holdAction();
            await page.goto(mediaPage);
            const media = page.locator('[data-field-control="photos"]');
            const notes = page.locator('[data-field-control="notes"] textarea');
            await notes.waitFor();
            const box = await notes.boundingBox();
            const requested = page.waitForRequest((request) =>
                new URL(request.url()).pathname.endsWith(`/${action}Media`),
            );
            await mutate(page, media, action);
            await requested;
            await notes.fill("Keep this unsaved note");
            await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(1, 5));
            const nav = await page.locator("cms-dashboards-nav").boundingBox();
            const content = page.locator("w13c-left-menu-layout main");
            const scroll = await content.evaluate((node) => node.scrollTop);
            if (captures) {
                await page.screenshot({ path: `${captures}/${action}-pending.png`, animations: "disabled" });
            }
            release();
            await page.getByText(/Media operation unavailable/).waitFor();
            expect(
                await media
                    .locator("[data-media-tile]")
                    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.mediaId)),
            ).toEqual(["front", "side", "back"]);
            expect(await notes.inputValue()).toBe("Keep this unsaved note");
            expect(
                await notes.evaluate((node: HTMLTextAreaElement) => [
                    node.matches(":focus"),
                    node.selectionStart,
                    node.selectionEnd,
                ]),
            ).toEqual([true, 1, 5]);
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(1);
            expect(fixture.resource.photos.map((item) => item.id)).toEqual(["front", "side", "back"]);
            expect(await notes.boundingBox()).toEqual(box);
            expect(await page.locator("cms-dashboards-nav").boundingBox()).toEqual(nav);
            expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
            for (let frame = 0; frame < 5; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
                expect(await notes.boundingBox()).toEqual(box);
                expect(await page.locator("cms-dashboards-nav").boundingBox()).toEqual(nav);
                expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
            }
            if (captures) {
                await page.screenshot({ path: `${captures}/${action}-failed.png`, animations: "disabled" });
            }

            const reloaded = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/item"));
            await mutate(page, media, action);
            await reloaded;
            for (let frame = 0; frame < 2; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            }
            expect(fixture.calls).toHaveLength(2);
            expect(await notes.inputValue()).toBe("Keep this unsaved note");
            expect(
                await media
                    .locator("[data-media-tile]")
                    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.mediaId)),
            ).toEqual(fixture.resource.photos.map((item) => item.id));
            await page.reload();
            await media.locator("[data-media-tile]").first().waitFor();
            expect(await media.locator("[data-media-tile]").count()).toBe(fixture.resource.photos.length);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 30_000);

async function mutate(page: Page, media: Locator, action: string): Promise<void> {
    if (action === "upload" || action === "replace") {
        const chooser = page.waitForEvent("filechooser");
        if (action === "upload") {
            await media.getByRole("button", { name: "Add media", exact: true }).click();
        } else {
            await media.locator("[data-media-tile]").first().click();
        }
        await (await chooser).setFiles(imageFile);
    } else if (action === "remove") {
        await media.locator("[data-media-tile]").first().hover();
        await media.getByRole("button", { name: "Remove media", exact: true }).first().click();
    } else {
        const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
        const tiles = media.locator("[data-media-tile]");
        await tiles.nth(2).dispatchEvent("dragstart", { dataTransfer });
        await tiles.nth(0).dispatchEvent("dragover", { dataTransfer });
        await tiles.nth(0).dispatchEvent("drop", { dataTransfer });
        await dataTransfer.dispose();
    }
}
