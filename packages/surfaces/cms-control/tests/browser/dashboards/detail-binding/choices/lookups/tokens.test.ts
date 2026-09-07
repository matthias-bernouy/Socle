import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installReadonlyRoutes } from "../../fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("token lookups wait for dependencies and preserve selected labels and typed saved arrays", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installReadonlyRoutes(page, bundle, styles, {
            resource: {
                id: "tokens",
                title: "Tokens",
                department: "",
                tags: ["old"],
                selected: [{ id: "old", label: "Existing tag" }],
            },
            fields: [
                {
                    id: "department",
                    label: "Department",
                    path: "department",
                    type: "select",
                    options: [
                        { value: "", label: "None" },
                        { value: "sport", label: "Sport" },
                    ],
                },
                {
                    id: "tags",
                    label: "Tags",
                    path: "tags",
                    type: "tokens",
                    required: true,
                    lookup: {
                        endpoint: "tags",
                        itemsPath: "items",
                        valuePath: "id",
                        labelPath: "label",
                        selected: "$resource.selected",
                        params: { department: "$field.department" },
                    },
                },
            ],
        });
        let reads = 0;
        await page.route("**/.cms/sources/store/tags?**", async (route) => {
            reads += 1;
            await route.fulfill({ json: { items: [{ id: "new", label: "New tag" }] } });
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const tags = page.locator('p9r-token-input[data-field-control="tags"]');
        await tags.getByRole("button", { name: "Remove Existing tag", exact: true }).waitFor();
        expect(reads).toBe(0);
        const department = page.locator('[data-field-control="department"]');
        await department.getByRole("combobox").click();
        await department.getByRole("option", { name: "Sport", exact: true }).click();
        await tags.locator('option[value="new"]').waitFor({ state: "attached" });
        expect(reads).toBe(1);
        await tags.locator("input").fill("New tag");
        await tags.locator("input").press("Enter");
        await tags.getByRole("button", { name: "Remove New tag", exact: true }).waitFor();
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect(fixture.saved).toEqual([{ department: "sport", tags: ["old", "new"] }]);
        await page.reload();
        await tags.getByRole("button", { name: "Remove New tag", exact: true }).waitFor();
        await department.getByRole("combobox").click();
        await department.getByRole("option", { name: "None", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('p9r-token-input option[value="new"]'));
        expect(reads).toBe(2);
        expect(await tags.getAttribute("value")).toBe("old,new");
        expect(await tags.evaluate((node) => node.getRootNode() === document)).toBe(true);
    } finally {
        await browser.close();
    }
}, 15_000);
