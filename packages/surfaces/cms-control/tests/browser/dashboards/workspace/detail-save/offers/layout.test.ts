import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { offerFixture } from "./fixture";

for (const width of [320, 390, 768, 1440]) {
    test(`detail sections and actions stay inside the viewport at ${width}px`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(6000);
            const { url, state } = await offerFixture(page);
            await page.goto(url);
            await page.locator('[name="title"] input').waitFor();
            const actions = page.locator('[slot="bound-actions"] p9r-button, p9r-button[slot="bound-actions"]');
            expect(await actions.count()).toBe(4);
            const elements = page.locator(
                'cms-detail-section, [name="title"], [name="description"], [name="quantityAvailable"]',
            );
            for (const element of [...(await elements.filter({ visible: true }).all()), ...(await actions.all())]) {
                const box = await element.boundingBox();
                expect(box).not.toBeNull();
                expect(box!.x).toBeGreaterThanOrEqual(0);
                expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
            }
            const actionBoxes = await Promise.all((await actions.all()).map((action) => action.boundingBox()));
            const rowCount = new Set(actionBoxes.map((box) => Math.round(box!.y + box!.height / 2))).size;
            if (width === 1440) {
                expect(rowCount).toBe(1);
            } else {
                expect(rowCount).toBeGreaterThan(1);
            }
            await page.screenshot({ path: `/tmp/cmscore-detail-wrap-${width}.png`, fullPage: true });
            const node = await page.locator('[name="title"] input').elementHandle();
            await page.getByRole("button", { name: "Request seller price", exact: true }).click();
            await page.locator("[data-operation-form]").filter({ visible: true }).waitFor();
            await page.keyboard.press("Escape");
            expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
            expect(state.writes).toEqual([]);
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 15000);
}
