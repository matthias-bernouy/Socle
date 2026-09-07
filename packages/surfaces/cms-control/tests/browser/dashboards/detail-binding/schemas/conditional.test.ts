import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installSchemaRoutes, schemaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional schemas settle while hidden and retain typed drafts when shown again", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installSchemaRoutes(page, bundle, styles, true);
        const release = fixture.holdSchema();
        await page.goto(schemaPage);
        const schema = page.locator('[data-field-control="metadata"]');
        const show = page.getByRole("checkbox", { name: "Show schema", exact: true });
        await schema.getByText("Loading dynamic fields…", { exact: true }).waitFor();
        await show.uncheck();
        expect(await schema.count()).toBe(0);
        const completed = page.waitForResponse((response) => response.url().includes("categoryFields"));
        release();
        await completed;
        await show.check();
        const serial = schema.locator('[data-schema-key="serial"] input');
        await serial.fill("Hidden schema draft");
        const optional = schema.getByRole("checkbox", { name: "Optional flag", exact: true });
        await schema.getByText("Optional flag", { exact: true }).click();
        expect(await optional.isChecked()).toBe(true);
        await show.uncheck();
        expect(await schema.count()).toBe(0);
        await show.check();
        await serial.waitFor();
        expect(await serial.inputValue()).toBe("Hidden schema draft");
        expect(await optional.isChecked()).toBe(true);
        expect(fixture.schemas).toHaveLength(1);
        const condition = schema.locator('[data-schema-key="condition"]');
        await condition.getByRole("combobox").click();
        await condition.getByRole("option", { name: "Used", exact: true }).click();
        const response = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await response;
        await page.reload();
        await serial.waitFor();
        expect(await serial.inputValue()).toBe("Hidden schema draft");
        expect(await optional.isChecked()).toBe(true);
        expect((fixture.saved[0]?.metadata as Record<string, unknown>).optionalFlag).toBe(true);
    } finally {
        await browser.close();
    }
}, 20_000);
