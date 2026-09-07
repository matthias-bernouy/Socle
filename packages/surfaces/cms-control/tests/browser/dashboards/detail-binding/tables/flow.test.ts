import { expect, test } from "bun:test";
import { chromium, type Locator, type Page } from "playwright";
import { resolve } from "node:path";
import { installTableRoutes, tablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("embedded tables preserve hidden row data, all editor values and derived rows through repeated saved reloads", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installTableRoutes(page, bundle, styles);
        const prices = structuredClone(fixture.resource.prices);
        await page.goto(tablePage);
        const axes = page.locator('[data-field-control="axes"]');
        const rows = axes.locator("[data-table-row]");
        const matrix = page.locator('[data-field-control="matrix"] [data-table-row]');
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await axes.evaluate((node) => node.getRootNode() === document)).toBe(true);
        expect(await rows.evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document))).toBe(true);
        expect(await page.locator("[data-config-json], [data-source-json]").count()).toBe(0);
        expect(await rows.count()).toBe(2);
        await rows.first().getByRole("button", { name: "Remove", exact: true }).click();
        expect(await rows.count()).toBe(1);
        await rows.first().locator('[data-table-column="label"] input').fill("Weight updated");
        await token(rows.first(), "285");
        const status = rows.first().locator('[data-table-column="status"]');
        await status.getByRole("combobox").click();
        await status.getByRole("option", { name: "Active", exact: true }).click();
        const brand = rows.first().locator('[data-table-column="brand"]');
        await brand.locator("input").fill("Wilson");
        await brand.getByRole("option", { name: "Wilson", exact: true }).click();
        expect(await matrix.count()).toBe(2);
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        expect(await rows.count()).toBe(2);
        await save(page);
        expect(fixture.saved[0]?.axes).toEqual([
            {
                id: "weight",
                details: { label: "Weight updated", values: ["300", "285"], hidden: "second" },
                status: "active",
                brand: "wilson",
                audit: { owner: "second" },
            },
        ]);
        expect(fixture.saved[0]?.prices).toEqual(prices);
        expect(fixture.lookups).toHaveLength(1);
        expect(fixture.saved[0]?.matrix).toEqual([
            {
                key: "weight-updated:300",
                options: "300",
                title: "Weight updated: 300",
                status: "inactive",
                position: 0,
            },
            {
                key: "weight-updated:285",
                options: "285",
                title: "Weight updated: 285",
                status: "inactive",
                position: 1,
            },
        ]);
        await page.reload();
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await rows.count()).toBe(1);
        expect(await rows.first().locator('[data-table-column="label"] input').inputValue()).toBe("Weight updated");
        expect(await brand.getAttribute("value")).toBe("wilson");
        expect(await status.getAttribute("value")).toBe("active");
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        await rows.last().locator('[data-table-column="label"] input').fill("Grip");
        await token(rows.last(), "L3");
        await token(rows.last(), "L4");
        expect(await matrix.count()).toBe(4);
        await save(page);
        expect((fixture.saved[1]?.axes as unknown[]).length).toBe(2);
        expect((fixture.saved[1]?.matrix as Array<{ title: string }>).map((row) => row.title)).toEqual([
            "Weight updated: 300 / Grip: L3",
            "Weight updated: 300 / Grip: L4",
            "Weight updated: 285 / Grip: L3",
            "Weight updated: 285 / Grip: L4",
        ]);
        await page.reload();
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await rows.count()).toBe(2);
        expect(await matrix.count()).toBe(4);
        expect(fixture.resource.prices).toEqual(prices);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25_000);

async function token(row: Locator, value: string) {
    const input = row.locator('[data-table-column="values"] input');
    await input.fill(value);
    await input.press("Enter");
    await row.getByRole("button", { name: `Remove ${value}`, exact: true }).waitFor();
}

async function save(page: Page) {
    const response = page.waitForResponse((value) => value.url().endsWith("/save"));
    await page.getByRole("button", { name: "Save choices", exact: true }).click();
    expect((await response).ok()).toBe(true);
}

test("standalone table details persist empty collections and a newly created row", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installTableRoutes(page, bundle, styles);
        await page.goto(tablePage.replace("&collection=detail&row=quality-table", ""));
        const axes = page.locator('[data-field-control="axes"]');
        const rows = axes.locator("[data-table-row]");
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        await rows.first().getByRole("button", { name: "Remove", exact: true }).click();
        await rows.first().getByRole("button", { name: "Remove", exact: true }).click();
        await save(page);
        expect(fixture.saved[0]?.axes).toEqual([]);
        expect(fixture.saved[0]?.matrix).toEqual([]);
        await page.reload();
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        await rows.first().locator('[data-table-column="label"] input').fill("First standalone axis");
        await save(page);
        await page.reload();
        await rows.first().locator('[data-table-column="label"] input').waitFor();
        expect(await rows.count()).toBe(1);
        expect(await rows.first().locator('[data-table-column="label"] input').inputValue()).toBe(
            "First standalone axis",
        );
    } finally {
        await browser.close();
    }
}, 20_000);
