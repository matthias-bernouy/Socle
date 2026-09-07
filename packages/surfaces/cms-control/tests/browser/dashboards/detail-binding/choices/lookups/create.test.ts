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

test("inline lookup creation binds its returned identifier and label before the detail save", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles, true);
        const creates: unknown[] = [];
        await page.route("**/.cms/sources/store/create-brand", async (route) => {
            expect(route.request().method()).toBe("POST");
            creates.push(route.request().postDataJSON());
            await route.fulfill({ json: { id: "created-brand", label: "Normalized new brand" } });
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=lookup");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        await brand.locator("input").fill("Novel");
        const created = page.waitForResponse((response) => response.url().endsWith("/create-brand"));
        await brand.getByRole("option", { name: 'Add "Novel"', exact: true }).click();
        await created;
        await brand.locator('option[value="created-brand"]').waitFor({ state: "attached" });
        expect(creates).toEqual([{ label: "Novel" }]);
        expect(fixture.requests.filter((path) => path.includes("/item"))).toHaveLength(1);
        await page.locator('[data-field-control="name"] input').focus();
        await page.waitForFunction(
            () =>
                document.querySelector("p9r-combobox")?.shadowRoot?.querySelector("input")?.value ===
                "Normalized new brand",
        );
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved).toEqual([{ name: "Initial", category: "tennis", brand: "created-brand" }]);
        await page.reload();
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        expect(await brand.getAttribute("value")).toBe("created-brand");
    } finally {
        await browser.close();
    }
}, 15_000);

test("a delayed inline creation preserves a newer selection and other edits", async () => {
    const browser = await chromium.launch();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles, true);
        await page.route("**/.cms/sources/store/create-brand", async (route) => {
            await pending;
            await route.fulfill({ json: { id: "created-brand", label: "Normalized new brand" } });
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=lookup");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        await brand.locator("input").fill("Novel");
        const created = page.waitForRequest("**/create-brand");
        await brand.getByRole("option", { name: 'Add "Novel"', exact: true }).click();
        await created;
        await brand.locator("input").fill("tennis Brand 0");
        await brand.getByRole("option", { name: "tennis Brand 0", exact: true }).click();
        await page.locator('[data-field-control="name"] input').fill("Newer name");
        const response = page.waitForResponse("**/create-brand");
        release();
        await response;
        await page.waitForLoadState("networkidle");
        expect(await brand.getAttribute("value")).toBe("brand-0");
        const saved = page.waitForResponse("**/save");
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved).toEqual([{ name: "Newer name", category: "tennis", brand: "brand-0" }]);
    } finally {
        release();
        await browser.close();
    }
}, 15_000);
