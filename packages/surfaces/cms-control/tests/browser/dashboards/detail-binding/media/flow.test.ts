import { expect, test } from "bun:test";
import { chromium, type Locator, type Page } from "playwright";
import { resolve } from "node:path";
import { imageFile, installMediaRoutes, mediaPage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("media upload, replacement, removal and ordering persist through full reloads", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installMediaRoutes(page, bundle, styles);
        await page.goto(mediaPage);
        const media = page.locator('[data-field-control="photos"]');
        await media.locator("[data-media-tile]").first().waitFor();
        const upload = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/uploadMedia"));
        const chooser = page.waitForEvent("filechooser");
        await media.getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles([imageFile]);
        await upload;
        await waitForImages(media, ["front view", "side view", "back view", imageFile.name]);
        expect(fixture.calls[0]!.params).toEqual({ record: "quality-media" });
        expect(fixture.calls[0]!.files).toHaveLength(1);
        expect(fixture.calls[0]!.files[0]!.name).toBe(imageFile.name);
        expect(fixture.calls[0]!.files[0]!.type).toBe(imageFile.mimeType);
        expect(await fixture.calls[0]!.files[0]!.text()).toBe(imageFile.buffer.toString());
        await page.reload();
        await waitForImages(media, ["front view", "side view", "back view", imageFile.name]);

        const replacement = { ...imageFile, name: "quality-replacement.svg" };
        const replace = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/replaceMedia"));
        const replacementChooser = page.waitForEvent("filechooser");
        await media.locator("[data-media-tile]").first().click();
        await (await replacementChooser).setFiles(replacement);
        await replace;
        await waitForImages(media, [replacement.name, "side view", "back view", imageFile.name]);
        expect(fixture.calls[1]!.params).toEqual({ id: "front" });
        expect(await fixture.calls[1]!.files[0]!.text()).toBe(replacement.buffer.toString());

        const remove = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/removeMedia"));
        await media.locator("[data-media-tile]").nth(1).hover();
        await media.getByRole("button", { name: "Remove media", exact: true }).nth(1).click();
        await remove;
        await waitForImages(media, [replacement.name, "back view", imageFile.name]);
        expect(fixture.calls[2]!.body).toEqual({ id: "side" });

        const reorder = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/reorderMedia"));
        await dragTile(page, media, 2, 0);
        await reorder;
        await waitForImages(media, [imageFile.name, replacement.name, "back view"]);
        expect(fixture.calls[3]!.body).toEqual({ ids: ["uploaded-1", "uploaded-2", "back"] });
        await page.reload();
        await waitForImages(media, [imageFile.name, replacement.name, "back view"]);
        expect(fixture.resource.photos.map((item) => item.id)).toEqual(["uploaded-1", "uploaded-2", "back"]);
        expect(fixture.calls).toHaveLength(4);
    } finally {
        await browser.close();
    }
}, 25_000);

test("a multiple-file choice sends each file once and reloads the persisted media list", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installMediaRoutes(page, bundle, styles);
        await page.goto(mediaPage);
        const media = page.locator('[data-field-control="photos"]');
        const files = [imageFile, { ...imageFile, name: "quality-side.svg" }];
        const chooser = page.waitForEvent("filechooser");
        await media.getByRole("button", { name: "Add media", exact: true }).click();
        expect((await chooser).isMultiple()).toBe(true);
        await (await chooser).setFiles(files);
        await media.locator('[data-media-tile] img[src="/media/uploaded-2.svg"]').waitFor();
        expect(fixture.calls.map((call) => call.action)).toEqual(["upload", "upload"]);
        expect(fixture.calls.flatMap((call) => call.files.map((file) => file.name)).sort()).toEqual(
            files.map((file) => file.name).sort(),
        );
        for (const call of fixture.calls) {
            expect(call.files).toHaveLength(1);
            expect(await call.files[0]!.text()).toBe(imageFile.buffer.toString());
        }
        await page.reload();
        await media.locator('[data-media-tile] img[src="/media/uploaded-2.svg"]').waitFor();
        expect(await media.locator("[data-media-tile]").count()).toBe(5);
        expect(fixture.resource.photos).toHaveLength(5);
    } finally {
        await browser.close();
    }
}, 15_000);

async function waitForImages(media: Locator, labels: string[]): Promise<void> {
    await media.locator("[data-media-tile] img").last().waitFor();
    for (const label of labels) {
        await media
            .locator("[data-media-tile] img")
            .and(media.getByAltText(label, { exact: true }))
            .waitFor();
    }
    expect(
        await media
            .locator("[data-media-tile] img")
            .evaluateAll((images) => images.map((image) => image.getAttribute("alt"))),
    ).toEqual(labels);
}

async function dragTile(page: Page, media: Locator, from: number, to: number): Promise<void> {
    const data = await page.evaluateHandle(() => new DataTransfer());
    const tiles = media.locator("[data-media-tile]");
    await tiles.nth(from).dispatchEvent("dragstart", { dataTransfer: data });
    await tiles.nth(to).dispatchEvent("dragover", { dataTransfer: data });
    await tiles.nth(to).dispatchEvent("drop", { dataTransfer: data });
    await data.dispose();
}
