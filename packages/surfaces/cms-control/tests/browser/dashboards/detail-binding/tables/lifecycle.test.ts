import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { resolve } from "node:path";
import { installTableRoutes, tablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("embedded table edits survive pending options and overlapping saves", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.setDefaultTimeout(5000);
        const fixture = await installTableRoutes(page, bundle, styles);
        const releaseLookup = fixture.holdLookup();
        await page.goto(tablePage);
        const rows = page.locator('[data-field-control="axes"] [data-table-row]');
        const label = rows.first().locator('[data-table-column="label"] input');
        await label.fill("Draft during lookup");
        await label.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 7));
        const beforeLookup = await state(label);
        releaseLookup();
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        expect(await label.inputValue()).toBe("Draft during lookup");
        const afterLookup = await state(label);
        expect(afterLookup).toEqual(beforeLookup);
        const releaseSave = fixture.holdSave();
        const requested = page.waitForRequest((request) => request.url().endsWith("/save"));
        const response = page.waitForResponse((value) => value.url().endsWith("/save"));
        const start = performance.now();
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await requested;
        await label.fill("Newer unsaved row");
        await label.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 6));
        const beforeSave = await state(label);
        const releaseAt = performance.now();
        releaseSave();
        await response;
        const frames = [];
        for (let index = 0; index < 5; index += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            frames.push(await state(label));
            expect(await state(label)).toEqual(beforeSave);
        }
        expect(await label.inputValue()).toBe("Newer unsaved row");
        expect((fixture.saved[0]?.axes as Array<{ details: { label: string } }>)[0]?.details.label).toBe(
            "Draft during lookup",
        );
        const second = page.waitForResponse((value) => value.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await second;
        await page.reload();
        await label.waitFor();
        expect(await label.inputValue()).toBe("Newer unsaved row");
        if (process.env.CMS_TABLE_OBSERVE) {
            console.info(
                JSON.stringify({
                    beforeLookup,
                    afterLookup,
                    beforeSave,
                    frames,
                    heldSaveMs: releaseAt - start,
                    lookupReads: fixture.lookups.length,
                    detailReads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                }),
            );
        }
    } finally {
        await browser.close();
    }
}, 20_000);

async function state(control: Locator) {
    return control.evaluate((node: HTMLInputElement) => {
        const box = node.getBoundingClientRect();
        return {
            value: node.value,
            focused: node.matches(":focus"),
            start: node.selectionStart,
            end: node.selectionEnd,
            box: [box.x, box.y, box.width, box.height],
        };
    });
}

test("a blank row added during a save remains editable after its response", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installTableRoutes(page, bundle, styles);
        await page.goto(tablePage);
        const axes = page.locator('[data-field-control="axes"]');
        const rows = axes.locator("[data-table-row]");
        await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
        const release = fixture.holdSave();
        const saving = page.waitForRequest((request) => request.url().endsWith("/save"));
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saving;
        await axes.getByRole("button", { name: "Add axis", exact: true }).click();
        expect(await rows.count()).toBe(3);
        release();
        await saved;
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        expect(await rows.count()).toBe(3);
        expect((fixture.saved[0]?.axes as unknown[]).length).toBe(2);
        await rows.last().locator('[data-table-column="label"] input').fill("New axis after response");
        const second = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await second;
        await page.reload();
        await rows.last().locator('[data-table-column="label"] input').waitFor();
        expect(await rows.count()).toBe(3);
        expect(await rows.last().locator('[data-table-column="label"] input').inputValue()).toBe(
            "New axis after response",
        );
    } finally {
        await browser.close();
    }
}, 20_000);
