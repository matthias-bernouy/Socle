import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { productFixture, detailUrl } from "./fixture";

test("product saves real main and aside controls and rereads only its mounted detail", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(6000);
        const state = await productFixture(page);
        await page.goto(detailUrl);
        const title = page.locator('[data-detail-save] [data-field-control="title"] input');
        await title.waitFor();
        await title.fill(" Updated racket ");
        const handle = await title.elementHandle();
        const form = page.locator("[data-detail-save]");
        expect(await form.locator("form").count()).toBe(0);
        expect(await form.locator('[name="status"]').count()).toBe(1);
        const response = page.waitForResponse("**/upsertProduct");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await response;
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(state.writes).toHaveLength(1);
        expect(state.writes[0]).toMatchObject({
            id: 42,
            expectedVersion: 7,
            title: " Updated racket ",
            status: "draft",
            visibility: "hidden",
            variantAxes: [],
            mediaIds: [],
        });
        expect(state.writes[0]).not.toHaveProperty("variantMatrix");
        expect(state.reads).toBe(2);
        expect(await handle!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await title.inputValue()).toBe("Updated racket");
        expect(state.errors).toEqual([]);
        await page.screenshot({
            path: "/tmp/cmscore-integration-view-step4/screens/product-saved-1440.png",
            fullPage: true,
        });
    } finally {
        await browser.close();
    }
}, 20000);
