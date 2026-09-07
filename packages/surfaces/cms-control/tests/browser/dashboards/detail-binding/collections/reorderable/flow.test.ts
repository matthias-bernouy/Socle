import { expect, test } from "bun:test";
import { chromium, type Page } from "playwright";
import { resolve } from "node:path";
import { installReorderableRoutes, reorderablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("reorderable rows and cards preserve edits, hidden metadata, drag order and limits across saved reloads", async () => {
    const browser = await chromium.launch();
    try {
        for (const layout of ["rows", "cards"] as const) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
            page.setDefaultTimeout(5000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const fixture = await installReorderableRoutes(page, bundle, styles, layout);
            await page.goto(reorderablePage);
            const list = page.locator('[data-field-control="choices"]');
            const rows = list.locator(".row[data-index]");
            await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
            const label = rows.first().locator('[data-item-field="label"] input');
            await label.fill("Agency updated");
            expect(await label.inputValue()).toBe("Agency updated");
            expect(
                await label.evaluate(
                    (node) =>
                        node.getRootNode() instanceof ShadowRoot &&
                        (node.getRootNode() as ShadowRoot).activeElement === node,
                ),
            ).toBe(true);
            await rows.first().locator('[data-item-field="required"]').check();
            if (layout === "cards") {
                await rows.first().locator("summary").click();
            }
            const status = rows.first().locator('[data-item-field="status"]');
            await status.getByRole("combobox").click();
            await status.getByRole("option", { name: "Inactive", exact: true }).click();
            const brand = rows.first().locator('[data-item-field="brand"]');
            await brand.locator("input").fill("Head");
            await brand.getByRole("option", { name: "Head", exact: true }).click();
            await list.getByRole("button", { name: "Add choice", exact: true }).click();
            expect(await rows.count()).toBe(3);
            expect(await list.getByRole("button", { name: "Add choice", exact: true }).isDisabled()).toBe(true);
            await rows.last().locator('[data-item-field="label"] input').fill("Partner");
            await rows.first().locator(".handle").dragTo(rows.last().locator(".handle"));
            expect(
                await rows
                    .locator('[data-item-field="label"] input')
                    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLInputElement).value)),
            ).toEqual(["Client", "Partner", "Agency updated"]);
            expect(await list.locator("[data-dragging], [data-drop-target]").count()).toBe(0);
            await rows.first().getByRole("button", { name: "Remove item", exact: true }).click();
            await save(page);
            const saved = fixture.saved[0]!.choices as Array<Record<string, unknown>>;
            expect(saved).toHaveLength(2);
            expect(saved[0]).toMatchObject({ metadata: { label: "Partner" }, order: { position: 0 } });
            expect(saved[1]).toEqual({
                id: "agency",
                metadata: { label: "Agency updated", hidden: "first" },
                required: true,
                status: "inactive",
                brand: "head",
                order: { position: 1, hidden: true },
                audit: { owner: "first" },
            });
            await page.reload();
            await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
            expect(await rows.count()).toBe(2);
            expect(await rows.last().locator('[data-item-field="label"] input').inputValue()).toBe("Agency updated");
            expect(await rows.last().locator('[data-item-field="required"]').isChecked()).toBe(true);
            await rows.last().getByRole("button", { name: "Remove item", exact: true }).click();
            expect(await rows.first().getByRole("button", { name: "Remove item", exact: true }).isDisabled()).toBe(
                true,
            );
            await save(page);
            await page.reload();
            await rows.first().locator('[data-item-field="label"] input').waitFor();
            expect(await rows.count()).toBe(1);
            expect(await rows.first().locator('[data-item-field="label"] input').inputValue()).toBe("Partner");
            expect(fixture.saved[1]!.choices).toEqual(fixture.resource.choices);
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);

async function save(page: Page) {
    const response = page.waitForResponse((value) => value.url().endsWith("/save"));
    await page.getByRole("button", { name: "Save choices", exact: true }).click();
    expect((await response).ok()).toBe(true);
}
