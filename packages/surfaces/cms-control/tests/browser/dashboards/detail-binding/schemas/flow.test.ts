import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { resolve } from "node:path";
import { installSchemaRoutes, schemaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("dynamic schema validates typed fields, preserves opaque metadata and persists repeated saves", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installSchemaRoutes(page, bundle, styles);
        await page.goto(schemaPage);
        const schema = page.locator('[data-field-control="metadata"]');
        const weight = schema.locator('[data-schema-key="weight"] input');
        const serial = schema.locator('[data-schema-key="serial"] input');
        const condition = schema.locator('[data-schema-key="condition"]');
        const save = page.getByRole("button", { name: "Save choices", exact: true });
        await weight.waitFor();
        expect(await weight.inputValue()).toBe("300");
        expect(await schema.locator('[data-schema-key="grip"]').count()).toBe(0);
        expect(await schema.locator('[data-schema-key="constructor"]').count()).toBe(0);
        await save.click();
        expect(fixture.saved).toHaveLength(0);
        expect(await schema.locator('[data-schema-key="condition"]').getAttribute("invalid")).not.toBeNull();
        await choose(condition, "Used");
        await weight.fill("");
        await save.click();
        expect(fixture.saved).toHaveLength(0);
        await weight.fill("315.5");
        await serial.fill("Edited serial");
        const submitted = page.waitForResponse((response) => response.url().endsWith("/save"));
        await save.click();
        await submitted;
        const first = {
            excluded: "grip",
            weight: 315.5,
            serial: "Edited serial",
            grip: "L1",
            optionalText: null,
            legacy: "preserved",
            condition: "Used",
            refurbished: false,
        };
        expect(fixture.saved[0]?.metadata).toEqual(first);
        await page.reload();
        await weight.waitFor();
        expect(await weight.inputValue()).toBe("315.5");
        expect(await serial.inputValue()).toBe("Edited serial");
        expect(await condition.getAttribute("value")).toBe("Used");
        const reads = fixture.schemas.length;
        await choose(schema.locator('[data-schema-key="excluded"]'), "none");
        const grip = schema.locator('[data-schema-key="grip"]');
        await grip.waitFor();
        expect(await grip.getAttribute("value")).toBe("L1");
        expect(fixture.schemas).toHaveLength(reads);
        await choose(grip, "L2");
        await schema.getByRole("checkbox", { name: "Refurbished", exact: true }).check();
        const second = page.waitForResponse((response) => response.url().endsWith("/save"));
        await save.click();
        await second;
        expect(fixture.saved[1]?.metadata).toEqual({ ...first, excluded: "none", grip: "L2", refurbished: true });
        await page.reload();
        await grip.waitFor();
        expect(await grip.getAttribute("value")).toBe("L2");
        expect(await schema.getByRole("checkbox", { name: "Refurbished", exact: true }).isChecked()).toBe(true);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25_000);

async function choose(control: Locator, label: string): Promise<void> {
    await control.getByRole("combobox").click();
    await control.getByRole("option", { name: label, exact: true }).click();
}
