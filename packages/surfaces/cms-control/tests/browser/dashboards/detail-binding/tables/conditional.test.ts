import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installTableRoutes, tablePage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional tables retain added rows and derived drafts while hidden and after saved reloads", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const fixture = await installTableRoutes(page, bundle, styles, true);
        await page.goto(tablePage);
        const axes = page.locator('[data-field-control="axes"]');
        const rows = axes.locator("[data-table-row]");
        const toggle = page.getByRole("checkbox", { name: "Show axes", exact: true });
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        await rows.first().locator('[data-table-column="label"] input').fill("Edited grip");
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        await rows.last().locator('[data-table-column="label"] input').fill("Finish");
        const tokens = rows.last().locator('[data-table-column="values"] input');
        await tokens.fill("Matte");
        await tokens.press("Enter");
        const matrix = page.locator('[data-field-control="matrix"]');
        const derived = await matrix.innerText();
        await toggle.uncheck();
        expect(await axes.count()).toBe(0);
        expect(await matrix.innerText()).toBe(derived);
        await toggle.check();
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await rows.count()).toBe(3);
        expect(await rows.first().locator('[data-table-column="label"] input').inputValue()).toBe("Edited grip");
        await rows.last().getByRole("button", { name: "Remove Matte", exact: true }).waitFor();
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        expect(await rows.count()).toBe(4);
        await toggle.uncheck();
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        expect((fixture.saved[0]?.axes as unknown[]).length).toBe(3);
        await page.reload();
        await toggle.waitFor();
        expect(await axes.count()).toBe(0);
        await toggle.check();
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await rows.count()).toBe(3);
        expect(await matrix.innerText()).toBe(derived);
    } finally {
        await browser.close();
    }
}, 20_000);
