import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { productFixture, detailUrl } from "./fixture";

test("product metadata, variant rows, empty collections and aside selections come from visible controls", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const state = await productFixture(page);
        await page.goto(detailUrl);
        const weight = page.locator('[data-schema-key="weight"] input');
        await weight.fill("0");
        const status = page.locator('p9r-select[name="status"]');
        await status.getByRole("combobox").click();
        await status.getByRole("option", { name: "Archived", exact: true }).click();
        const axes = page.locator('[data-field-control="variantAxes"]');
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        const field = axes.locator('[data-table-column="fieldKey"]');
        await field.locator("input").fill("Weight");
        await field.getByRole("option", { name: "Weight", exact: true }).click();
        const tokens = axes.locator('[data-table-column="values"] input');
        await tokens.fill("300");
        await tokens.press("Enter");
        await tokens.fill("320");
        await tokens.press("Enter");
        expect(await page.locator('[data-field-control="variantMatrix"] [data-table-row]').count()).toBe(2);
        expect(await page.locator('[data-schema-key="weight"]').count()).toBe(0);
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(state.writes[0]).toMatchObject({
            status: "archived",
            metadata: { approved: false },
            variantAxes: [{ fieldKey: "weight", values: ["300", "320"] }],
        });
        expect(state.writes[0]).not.toHaveProperty("variantMatrix");
        await page.reload();
        await axes.getByRole("button", { name: "Remove", exact: true }).click();
        await weight.fill("0");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "9",
        );
        expect(state.writes[1]).toMatchObject({ metadata: { weight: 0, approved: false }, variantAxes: [] });
        await weight.fill("");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "10",
        );
        expect(state.writes[2]?.metadata.weight).toBeNull();
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
