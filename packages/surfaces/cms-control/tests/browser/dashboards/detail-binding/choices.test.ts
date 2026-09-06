import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installReadonlyRoutes } from "./fixture";

const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("static combobox and token choices survive saves and reloads with typed arrays", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installReadonlyRoutes(page, bundle, styles, {
            resource: { id: "choices", brand: "first", tags: ["one"] },
            fields: [
                {
                    id: "brand",
                    label: "Brand",
                    path: "brand",
                    type: "combobox",
                    options: [
                        { label: "First", value: "first" },
                        { label: "Second", value: "second" },
                    ],
                },
                {
                    id: "tags",
                    label: "Tags",
                    path: "tags",
                    type: "tokens",
                    required: true,
                    allowCustom: true,
                    options: [
                        { label: "One", value: "one" },
                        { label: "Two", value: "two" },
                    ],
                },
            ],
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const detail = page.locator("cms-dashboard-w-detail");
        const brand = detail.locator("p9r-combobox");
        const tags = detail.locator("p9r-token-input");
        await brand.locator("input").fill("Sec");
        await brand.getByRole("option", { name: "Second", exact: true }).click();
        await tags.getByRole("button", { name: "Remove One", exact: true }).click();
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        expect(fixture.saved).toHaveLength(0);
        expect(await tags.getAttribute("aria-invalid")).toBe("true");
        await tags.locator("input").fill("Two");
        await tags.locator("input").press("Enter");
        await tags.locator("input").fill("custom");
        await tags.locator("input").press("Enter");
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        expect((await saved).status()).toBe(200);
        expect(fixture.saved).toEqual([{ brand: "second", tags: ["two", "custom"] }]);
        expect(
            await detail
                .locator("[data-field-control]")
                .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
        ).toBe(true);
        await page.reload();
        await tags.getByRole("button", { name: "Remove custom", exact: true }).waitFor();
        expect(await brand.locator("input").inputValue()).toBe("Second");
        await tags.getByRole("button", { name: "Remove custom", exact: true }).click();
        const secondSave = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await secondSave;
        await page.reload();
        await tags.getByRole("button", { name: "Remove Two", exact: true }).waitFor();
        expect(await tags.getByRole("button", { name: "Remove custom", exact: true }).count()).toBe(0);
        expect(fixture.saved[1]).toEqual({ brand: "second", tags: ["two"] });
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20_000);
