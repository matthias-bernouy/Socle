import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { detailUrl, productFixture } from "./fixture";

// The baseline bundle is captured before this migration, outside tracked artifacts.
const baseline = "/tmp/cmscore-integration-view-step4/control-before.js";
test.skipIf(!(await Bun.file(baseline).exists()))(
    "product columns retain their baseline geometry on desktop and mobile",
    async () => {
        const browser = await chromium.launch();
        try {
            for (const width of [1440, 390]) {
                const boxes: unknown[] = [];
                for (const before of [true, false]) {
                    const page = await browser.newPage({ viewport: { width, height: 1000 } });
                    page.setDefaultTimeout(6000);
                    const state = await productFixture(page, before ? { baseline } : {});
                    await page.goto(detailUrl);
                    await page.locator('[data-field-control="title"] input').waitFor();
                    await page.locator('[data-schema-key="weight"] input').waitFor();
                    boxes.push(await page.locator('[data-field-control="title"]').boundingBox());
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                    await page.screenshot({
                        path: `/tmp/cmscore-integration-view-step4/screens/product-${before ? "before" : "after"}-${width}.png`,
                        fullPage: true,
                    });
                    expect(state.errors).toEqual([]);
                    await page.close();
                }
                expect(boxes[1]).toEqual(boxes[0]);
            }
        } finally {
            await browser.close();
        }
    },
    25000,
);
