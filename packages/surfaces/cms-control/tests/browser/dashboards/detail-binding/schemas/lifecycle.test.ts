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

test("schema dependencies avoid empty requests and recover from failures without dropping stored metadata", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installSchemaRoutes(page, bundle, styles);
        fixture.resource.category = "";
        const original = structuredClone(fixture.resource.metadata);
        await page.goto(schemaPage);
        const category = page.locator('[data-field-control="category"]');
        const schema = page.locator('[data-field-control="metadata"]');
        await schema.getByText("No dynamic fields are configured.", { exact: true }).waitFor();
        expect(fixture.schemas).toHaveLength(0);
        fixture.failSchema();
        await choose(category, "tennis");
        await schema.getByText(/Dynamic fields are temporarily unavailable/).waitFor();
        await page.locator('[data-field-control="notes"] textarea').fill("Saved despite unavailable schema");
        const response = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await response;
        expect(fixture.saved[0]?.metadata).toEqual(original);
        await page.reload();
        await schema.locator('[data-schema-key="weight"] input').waitFor();
        expect(await page.locator('[data-field-control="notes"] textarea').inputValue()).toBe(
            "Saved despite unavailable schema",
        );
        expect(fixture.resource.metadata).toEqual(original);
        const reads = fixture.schemas.length;
        await choose(category, "empty");
        await schema.getByText("No dynamic fields are configured.", { exact: true }).waitFor();
        expect(fixture.schemas).toHaveLength(reads + 1);
        await choose(category, "tennis");
        await schema.locator('[data-schema-key="weight"] input').waitFor();
        expect(await schema.locator('[data-schema-key="weight"] input').inputValue()).toBe("300");
        expect(fixture.resource.metadata).toEqual(original);
    } finally {
        await browser.close();
    }
}, 20_000);

test("a late schema response cannot replace the selected category's fields", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installSchemaRoutes(page, bundle, styles);
        const release = fixture.holdSchema("padel");
        await page.goto(schemaPage);
        const schema = page.locator('[data-field-control="metadata"]');
        const category = page.locator('[data-field-control="category"]');
        await schema.locator('[data-schema-key="weight"] input').waitFor();
        const pending = page.waitForRequest((request) => request.url().includes("categoryFields?category=padel"));
        await choose(category, "padel");
        await pending;
        await schema.getByText("Loading dynamic fields…", { exact: true }).waitFor();
        await choose(category, "tennis");
        await schema.locator('[data-schema-key="weight"] input').waitFor();
        const notes = page.locator('[data-field-control="notes"] textarea');
        await notes.fill("Newer category draft");
        await notes.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(1, 5));
        const position = await notes.boundingBox();
        release();
        const late = fixture.schemas.find((request) => request.category === "padel")!;
        for (let attempt = 0; attempt < 100 && !late.finished; attempt += 1) {
            await Bun.sleep(10);
        }
        expect(late.finished).toBeDefined();
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await schema.locator('[data-schema-key="length"]').count()).toBe(0);
            expect(await notes.inputValue()).toBe("Newer category draft");
            expect(await notes.boundingBox()).toEqual(position);
            expect(
                await notes.evaluate((node: HTMLTextAreaElement) => [
                    node.matches(":focus"),
                    node.selectionStart,
                    node.selectionEnd,
                ]),
            ).toEqual([true, 1, 5]);
        }
        expect(fixture.schemas.map((request) => request.category)).toEqual(["tennis", "padel", "tennis"]);
    } finally {
        await browser.close();
    }
}, 20_000);

async function choose(control: Locator, label: string): Promise<void> {
    await control.getByRole("combobox").click();
    await control.getByRole("option", { name: label, exact: true }).click();
}
