import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installRemoteTables } from "./remote.fixture";
import { tablePage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("table lookup columns share requests across rows while isolating search, pagination and stale responses", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(5000);
        const fixture = await installRemoteTables(page, bundle, styles);
        await page.goto(tablePage);
        const rows = page.locator('[data-field-control="rows"] [data-table-row]');
        const firstBrand = rows.first().locator('[data-table-column="brand"]');
        const secondBrand = rows.last().locator('[data-table-column="brand"]');
        const supplier = rows.first().locator('[data-table-column="supplier"]');
        await firstBrand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        await supplier.locator('option[value="supplier-0"]').waitFor({ state: "attached" });
        expect(fixture.reads).toHaveLength(2);
        await rows.first().locator('[data-table-column="label"] input').fill("Retain row draft");
        const release = fixture.holdQuery("Old");
        const requested = page.waitForRequest((request) => request.url().includes("q=Old"));
        await firstBrand.locator("input").fill("Old");
        await requested;
        await secondBrand.locator("input").fill("New");
        await secondBrand.getByRole("option", { name: "New brand 0", exact: true }).waitFor();
        release();
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        expect(await secondBrand.locator("input").inputValue()).toBe("New");
        const load = secondBrand.getByRole("button", { name: "Load more", exact: true });
        await load.evaluate((node) => {
            node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        });
        await secondBrand.getByRole("option", { name: "New brand 26", exact: true }).waitFor();
        expect(fixture.reads.filter((request) => request.q === "New" && request.offset === 25)).toHaveLength(1);
        expect(fixture.reads.filter((request) => request.kind === "supplier")).toHaveLength(1);
        await secondBrand.getByRole("option", { name: "New brand 26", exact: true }).click();
        expect(await firstBrand.locator('option[value="brand-26"]').count()).toBe(1);
        expect(await rows.first().locator('[data-table-column="label"] input').inputValue()).toBe("Retain row draft");
        fixture.fail("Broken");
        const failed = page.waitForResponse((response) => response.url().includes("q=Broken"));
        await supplier.locator("input").fill("Broken");
        expect((await failed).status()).toBe(503);
        await supplier.locator("input").fill("Broken retry");
        await supplier.getByRole("option", { name: "Broken retry supplier 0", exact: true }).click();
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved[0]?.rows).toEqual([
            { id: "first", label: "Retain row draft", brand: "brand-0", supplier: "supplier-0" },
            { id: "second", label: "Second", brand: "brand-26", supplier: "supplier-1" },
        ]);
        const category = page.locator('[data-field-control="category"]');
        await category.getByRole("combobox").click();
        await category.getByRole("option", { name: "Padel", exact: true }).click();
        await firstBrand.locator("input").focus();
        await firstBrand.getByRole("option", { name: "padel brand 0", exact: true }).waitFor();
        expect(fixture.reads.filter((request) => request.category === "padel")).toHaveLength(2);
        await page.reload();
        await firstBrand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await secondBrand.getAttribute("value")).toBe("brand-26");
        expect(await rows.first().locator('[data-table-column="label"] input').inputValue()).toBe("Retain row draft");
    } finally {
        await browser.close();
    }
}, 25_000);
