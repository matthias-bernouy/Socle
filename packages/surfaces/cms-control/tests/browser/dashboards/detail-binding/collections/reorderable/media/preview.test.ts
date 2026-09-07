import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installNestedRoutes } from "./fixture";
import { reorderablePage } from "../fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../../foundation/components/dist/style.css"),
).text();

test("nested media previews bind the owning choice and restore focus on desktop and mobile without writes", async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            page.setDefaultTimeout(5000);
            let pickers = 0;
            page.on("filechooser", () => {
                pickers += 1;
            });
            const fixture = await installNestedRoutes(page, bundle, styles);
            await page.goto(reorderablePage);
            const media = page
                .locator('[data-field-control="choices"] .row[data-index]')
                .first()
                .locator('[data-item-field="photo"]');
            const trigger = media.getByRole("button", { name: "Preview", exact: true });
            await trigger.click();
            const dialog = media.locator("[data-preview-dialog]");
            const image = media.locator('[data-preview-image][data-state="ready"]');
            await image.waitFor();
            expect(await image.getAttribute("src")).toBe("/example.svg");
            expect(await image.getAttribute("alt")).toBe("Agency image");
            expect(await media.locator('[slot="counter"]').textContent()).toBe("1 / 1");
            expect(await dialog.getByRole("button", { name: "Next image", exact: true }).isVisible()).toBe(false);
            const box = await dialog.boundingBox();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(width);
            await page.keyboard.press("Escape");
            await dialog.waitFor({ state: "hidden" });
            expect(await trigger.evaluate((node) => node.matches(":focus"))).toBe(true);
            await media.locator("[data-preview-image]").waitFor({ state: "detached" });
            expect(await media.locator("[data-preview-image]").count()).toBe(0);
            expect(fixture.calls).toHaveLength(0);
            expect(fixture.saved).toHaveLength(0);
            expect(pickers).toBe(0);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 15_000);
