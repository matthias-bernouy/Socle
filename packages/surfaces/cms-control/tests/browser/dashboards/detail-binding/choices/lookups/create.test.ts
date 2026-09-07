import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installLookupRoutes } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("allowCustom keeps a free lookup value local until the main detail is saved", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles, true);
        const writes: string[] = [];
        page.on("request", (request) => {
            if (request.method() !== "GET") {
                writes.push(request.url());
            }
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=lookup");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        await brand.locator("input").fill("Novel");
        await brand.getByRole("option", { name: 'Add "Novel"', exact: true }).click();
        await page.locator('[data-field-control="name"] input').focus();
        expect(await brand.getAttribute("value")).toBe("Novel");
        expect(writes).toEqual([]);
        expect(fixture.requests.filter((path) => path.includes("/item"))).toHaveLength(1);
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved).toEqual([{ name: "Initial", category: "tennis", brand: "Novel" }]);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toEndWith("/save");
        await page.reload();
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await brand.getAttribute("value")).toBe("Novel");
    } finally {
        await browser.close();
    }
}, 15_000);

test("a remote lookup without allowCustom cannot create a resource by typing", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles);
        const writes: string[] = [];
        page.on("request", (request) => {
            if (request.method() !== "GET") {
                writes.push(request.url());
            }
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=lookup");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await brand.getAttribute("creatable")).toBeNull();
        const searched = page.waitForResponse((response) => response.url().includes("q=Novel"));
        await brand.locator("input").fill("Novel");
        await searched;
        expect(await brand.getByRole("option", { name: 'Add "Novel"', exact: true }).count()).toBe(0);
        expect(writes).toEqual([]);
        expect(fixture.saved).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15_000);
