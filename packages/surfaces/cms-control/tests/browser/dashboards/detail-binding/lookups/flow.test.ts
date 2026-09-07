import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installLookupRoutes } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("lookup sources render remote options, paginate and preserve edits through saved reloads", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installLookupRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const detail = page.locator("cms-dashboard-w-detail");
        const brand = detail.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await detail.getAttribute("data-declarative")).toBe("");
        expect(await brand.evaluate((node) => node.getRootNode() === document)).toBe(true);
        expect(await brand.locator("input").inputValue()).toBe("Historic brand");
        expect(fixture.reads).toHaveLength(1);
        await detail.locator('[data-field-control="name"] input').fill("Unsaved draft");
        await brand.locator("input").fill("Wilson");
        await brand.getByRole("option", { name: "Wilson Brand 0", exact: true }).waitFor();
        expect(await brand.locator("input").inputValue()).toBe("Wilson");
        await brand.getByRole("button", { name: "Load more", exact: true }).click();
        await brand.getByRole("option", { name: "Wilson Brand 26", exact: true }).waitFor();
        expect(await brand.getByRole("button", { name: "Load more", exact: true }).count()).toBe(0);
        await brand.getByRole("option", { name: "Wilson Brand 26", exact: true }).click();
        expect(await detail.locator('[data-field-control="name"] input').inputValue()).toBe("Unsaved draft");
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await detail.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved).toEqual([{ name: "Unsaved draft", category: "tennis", brand: "brand-26" }]);
        await page.reload();
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await brand.getAttribute("value")).toBe("brand-26");
        expect(await detail.locator('[data-field-control="name"] input').inputValue()).toBe("Unsaved draft");
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20_000);
