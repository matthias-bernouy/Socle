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

test("media acknowledgements preserve drafts, focus, selection and scroll in selected and standalone details", async () => {
    const browser = await chromium.launch();
    try {
        for (const standalone of [false, true]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 850 } });
            page.setDefaultTimeout(5000);
            await page.addInitScript(() => {
                const created: string[] = [];
                const revoked: string[] = [];
                const create = URL.createObjectURL.bind(URL);
                const revoke = URL.revokeObjectURL.bind(URL);
                URL.createObjectURL = (blob) => {
                    const url = create(blob);
                    created.push(url);
                    return url;
                };
                URL.revokeObjectURL = (url) => {
                    revoked.push(url);
                    revoke(url);
                };
                Object.assign(window, { mediaTestUrls: { created, revoked } });
            });
            const fixture = await installMediaRoutes(page, bundle, styles, true);
            const release = fixture.holdAction();
            const url = new URL(mediaPage);
            if (standalone) {
                url.searchParams.delete("collection");
                url.searchParams.delete("row");
            }
            await page.goto(url.toString());
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
                value: await notes.inputValue(),
                focus: await notes.evaluate((node) => node.matches(":focus")),
                selection: await notes.evaluate((node: HTMLTextAreaElement) => [
                    node.selectionStart,
                    node.selectionEnd,
                ]),
                scroll: await page.locator("w13c-left-menu-layout main").evaluate((node) => node.scrollTop),
                nav: await page.locator("cms-dashboards-nav").boundingBox(),
                field: await notes.boundingBox(),
            });
            const before = await snapshot();
            expect(before.scroll).toBeGreaterThan(0);
            for (let frame = 0; frame < 5; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
                expect(await snapshot()).toEqual(before);
            }
            release();
            await media.locator('[data-media-tile] img[src="/media/uploaded-1.svg"]').waitFor();
            expect(await snapshot()).toEqual(before);
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(2);
            expect(fixture.calls).toHaveLength(1);
            expect(await media.evaluate((node) => node.getRootNode() === document)).toBe(true);
            expect(
                await media
                    .locator("[data-media-tile] img")
                    .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
            ).toBe(true);
            const urls = await page.evaluate(
                () => (window as unknown as { mediaTestUrls: { created: string[]; revoked: string[] } }).mediaTestUrls,
            );
            expect(urls.created).toHaveLength(1);
            expect(urls.revoked).toEqual(urls.created);
            const save = page.waitForResponse((response) => response.url().endsWith("/save"));
            await page.getByRole("button", { name: "Save choices", exact: true }).click();
            await save;
            await page.reload();
            await notes.waitFor();
            expect(await notes.inputValue()).toBe("Draft during the pending upload");
            expect(fixture.resource.notes).toBe("Draft during the pending upload");
            expect(fixture.resource.photos.map((item) => item.id)).toEqual(["front", "side", "back", "uploaded-1"]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);
