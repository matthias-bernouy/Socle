import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { imageFile, installMediaRoutes, mediaPage } from "../fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional media keeps its file through remounts and settles success or failure while hidden", async () => {
    const browser = await chromium.launch();
    try {
        for (const failed of [false, true]) {
            const page = await browser.newPage();
            page.setDefaultTimeout(5000);
            await page.addInitScript(() => {
                const revoked: string[] = [];
                const revoke = URL.revokeObjectURL.bind(URL);
                URL.revokeObjectURL = (url) => {
                    revoked.push(url);
                    revoke(url);
                };
                Object.assign(window, { mediaRevoked: revoked });
            });
            const fixture = await installMediaRoutes(page, bundle, styles, false, true);
            if (failed) {
                fixture.fail();
            }
            const release = fixture.holdAction();
            await page.goto(mediaPage);
            const media = page.locator('[data-field-control="photos"]');
            const show = page.getByRole("checkbox", { name: "Show media", exact: true });
            const request = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/uploadMedia"));
            const chooser = page.waitForEvent("filechooser");
            await media.getByRole("button", { name: "Add media", exact: true }).click();
            await (await chooser).setFiles(imageFile);
            await request;
            const image = media.locator("[data-pending] img");
            await image.waitFor();
            const localUrl = await image.getAttribute("src");
            if (!localUrl) {
                throw new Error("Pending media has no file URL");
            }
            expect(localUrl.startsWith("blob:")).toBe(true);
            await show.uncheck();
            expect(await media.count()).toBe(0);
            await show.check();
            await image.waitFor();
            expect(await image.getAttribute("src")).toBe(localUrl);
            expect(await page.evaluate((url) => fetch(url).then((response) => response.text()), localUrl)).toBe(
                imageFile.buffer.toString(),
            );
            expect(fixture.calls).toHaveLength(1);
            await show.uncheck();
            const notes = page.locator('[data-field-control="notes"] textarea');
            await notes.fill("Hidden upload draft");
            await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 6));
            const completion = failed
                ? page.getByText(/Media operation unavailable/).waitFor()
                : page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/item"));
            release();
            await completion;
            for (let frame = 0; frame < 2; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            }
            expect(await media.count()).toBe(0);
            expect(await page.evaluate(() => (window as unknown as { mediaRevoked: string[] }).mediaRevoked)).toEqual([
                localUrl,
            ]);
            expect(await notes.inputValue()).toBe("Hidden upload draft");
            expect(
                await notes.evaluate((node: HTMLTextAreaElement) => [
                    node.matches(":focus"),
                    node.selectionStart,
                    node.selectionEnd,
                ]),
            ).toEqual([true, 2, 6]);
            await show.check();
            await media.locator("[data-media-tile]").first().waitFor();
            expect(await media.locator("[data-media-tile]").count()).toBe(failed ? 3 : 4);
            expect(await media.locator("[data-pending]").count()).toBe(0);
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(failed ? 1 : 2);
            expect(fixture.calls).toHaveLength(1);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);
