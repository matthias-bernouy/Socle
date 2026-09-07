import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installMediaRoutes, mediaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("media preview navigates originals, handles broken images and restores focus without writes", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(5000);
        const fixture = await installMediaRoutes(page, bundle, styles);
        let pickers = 0;
        page.on("filechooser", () => {
            pickers += 1;
        });
        await page.goto(mediaPage);
        const media = page.locator('[data-field-control="photos"]');
        const trigger = media.getByRole("button", { name: "Preview", exact: true });
        await trigger.click();
        const dialog = media.locator("[data-preview-dialog]");
        const image = dialog.locator("[data-preview-image]");
        expect(await dialog.getAttribute("open")).toBe("");
        expect(await dialog.locator("[data-preview-counter]").textContent()).toBe("1 / 3");
        expect(await image.getAttribute("src")).toBe("/media/front.svg");
        expect(await dialog.getByRole("button", { name: "Close" }).evaluate((node) => node.matches(":focus"))).toBe(
            true,
        );
        await dialog.getByRole("button", { name: "Next image", exact: true }).click();
        expect(await image.getAttribute("src")).toBe("/media/side.svg");
        await dialog.locator('[data-preview-index="2"]').click();
        expect(await image.getAttribute("src")).toBe("/media/back.svg");
        await page.keyboard.press("Home");
        expect(await dialog.locator('[data-preview-index="0"]').evaluate((node) => node.matches(":focus"))).toBe(true);
        await page.keyboard.press("ArrowLeft");
        expect(await dialog.locator("[data-preview-counter]").textContent()).toBe("3 / 3");
        await page.keyboard.press("End");
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "hidden" });
        await dialog.locator("[data-preview-image]:not([src])").waitFor({ state: "attached" });
        expect(await trigger.evaluate((node) => node.matches(":focus"))).toBe(true);
        expect(await image.getAttribute("src")).toBeNull();

        fixture.failImages();
        fixture.resource.photos = [{ id: "broken", url: "/media/broken.svg", alt: "Broken image" }];
        await page.reload();
        await trigger.click();
        await dialog.getByText("Unable to load this image.", { exact: true }).waitFor();
        expect(await dialog.getByRole("button", { name: "Next image", exact: true }).isVisible()).toBe(false);
        expect(await dialog.locator("[data-preview-strip]").isVisible()).toBe(false);
        await dialog.getByRole("button", { name: "Close" }).click();
        await dialog.waitFor({ state: "hidden" });
        expect(await trigger.evaluate((node) => node.matches(":focus"))).toBe(true);
        expect(fixture.calls).toHaveLength(0);
        expect(pickers).toBe(0);
    } finally {
        await browser.close();
    }
}, 20_000);
