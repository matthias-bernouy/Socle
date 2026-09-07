import { chromium } from "playwright";
import { resolve } from "node:path";
import { imageFile, installMediaRoutes, mediaPage } from "./fixture";

// Observation command, not a passing stability test. Turn observations into
// assertions when the media renderer and its action lifecycle are migrated.
const bundle = await Bun.file(
    process.env.CMS_MEDIA_BASELINE ??
        resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
    page.setDefaultTimeout(5000);
    const fixture = await installMediaRoutes(page, bundle, styles, true);
    const release = fixture.holdAction();
    await page.goto(mediaPage);
    const media = page.locator('[data-field-control="photos"]');
    const request = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/uploadMedia"));
    const chooser = page.waitForEvent("filechooser");
    await media.getByRole("button", { name: "Add media", exact: true }).click();
    await (await chooser).setFiles(imageFile);
    await request;
    const notes = page.locator('[data-field-control="notes"] textarea');
    await notes.fill("Draft during the pending upload");
    await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 8));
    const snapshot = async () => ({
        notes: await notes.inputValue(),
        focus: await notes.evaluate((node) => node.matches(":focus")),
        selection: await notes.evaluate((node: HTMLTextAreaElement) => [node.selectionStart, node.selectionEnd]),
        scroll: await page.locator("w13c-left-menu-layout main").evaluate((node) => node.scrollTop),
        nav: await page.locator("cms-dashboards-nav").boundingBox(),
        field: await notes.boundingBox(),
    });
    const before = await snapshot();
    const pending = [];
    for (let frame = 0; frame < 5; frame += 1) {
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        pending.push(await snapshot());
    }
    const response = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/item"));
    const start = performance.now();
    release();
    await response;
    await media.locator('[data-media-tile] img[src="/media/uploaded-1.svg"]').waitFor();
    const completedMs = performance.now() - start;
    const after = await snapshot();
    console.info(
        JSON.stringify(
            {
                before,
                pending,
                after,
                completedMs,
                reads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                actions: fixture.calls.length,
                persistedNotes: fixture.resource.notes,
                persistedMedia: fixture.resource.photos.map((item) => item.id),
            },
            null,
            2,
        ),
    );
} finally {
    await browser.close();
}
