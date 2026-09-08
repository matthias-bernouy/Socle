import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";
import { cases, endpointFor } from "./definitions";
import { integrationFixture } from "./fixture";

let browser: Browser;
beforeAll(async () => {
    browser = await chromium.launch();
});
afterAll(async () => {
    await browser.close();
});

for (const entry of cases) {
    test(`${entry.widget.id}: native forms preserve the detail and reload after success`, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
        try {
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            page.on("dialog", (dialog) => dialog.accept());
            const { state, url } = await integrationFixture(page, entry);
            await page.goto(url);
            const host = page.locator(`cms-dashboard-w-detail[data-widget-id="${entry.widget.id}"]`);
            await host.locator("cms-detail-section").first().waitFor({ state: "visible" });
            const node = await host.elementHandle();
            const section = await host.locator("cms-detail-section").first().elementHandle();
            const operations = entry.widget.save
                ? [{ id: "save", label: entry.widget.save.label, form: entry.widget.save }]
                : entry.widget.actions.filter((a: any) => a.form);
            for (const action of operations) {
                const button = host
                    .locator('[slot="bound-actions"]')
                    .getByRole("button", { name: action.label, exact: true });
                const refreshed = page.waitForResponse((r) => r.url().includes(`/${entry.widget.source.endpoint}`));
                await button.click();
                const modal = host.locator("p9r-modal[open]");
                if (action.id !== "save" && (action.form.fields?.length || action.form.confirm)) {
                    await modal.locator("[data-operation-form]").waitFor({ state: "visible" });
                    expect(await page.locator("form form").count()).toBe(0);
                    await page.screenshot({ path: `/tmp/cmscore-all-views-${entry.widget.id}-${action.id}.png` });
                    await modal.getByRole("button", { name: action.label, exact: true }).click();
                }
                await refreshed;
                await page.waitForFunction(
                    () =>
                        Array.from(document.querySelectorAll("cms-dashboard-w-detail")).some(
                            (e) => e.getAttribute("aria-busy") !== "true",
                        ) && document.querySelectorAll("p9r-modal[open]").length === 0,
                    null,
                );
                expect(state.writes.at(-1)?.endpoint).toBe(action.form.endpoint);
                const schema = endpointFor(entry, action.form).body;
                const payload = state.writes.at(-1)!.body;
                for (const key of schema?.required ?? []) {
                    expect(payload).toHaveProperty(key);
                }
                for (const [key, field] of Object.entries(schema?.properties ?? {}) as Array<[string, any]>) {
                    if (payload[key] != null && ["string", "number", "boolean"].includes(field.type)) {
                        expect(typeof payload[key]).toBe(field.type);
                    }
                }
                for (const field of action.form.hiddenFields ?? []) {
                    if (Object.hasOwn(state.writes.at(-1)!.body, field.name)) {
                        expect(typeof state.writes.at(-1)!.body[field.name]).toBe(field.type);
                    }
                }
                expect(await node!.evaluate((e) => e.isConnected)).toBe(true);
                expect(await section!.evaluate((e) => e.isConnected)).toBe(true);
            }
            expect(state.errors).toEqual([]);
            await page.screenshot({ path: `/tmp/cmscore-all-views-${entry.widget.id}-desktop.png` });
            await page.setViewportSize({ width: 390, height: 844 });
            const bounds = await host.locator("cms-detail-section").first().boundingBox();
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
            await page.screenshot({ path: `/tmp/cmscore-all-views-${entry.widget.id}-mobile.png` });
        } finally {
            await context.close();
        }
    }, 45000);
}

test("allowed values submit their edited rows and an empty list after removal", async () => {
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        const entry = cases.find((item) => item.widget.id === "extraFieldDetail")!;
        const { state, url } = await integrationFixture(page, entry);
        state.resource.hasAllowedValues = true;
        state.resource.options = [{ id: "first", value: "first", label: "First", position: 0 }];
        await page.goto(url);
        const host = page.locator('cms-dashboard-w-detail[data-widget-id="extraFieldDetail"]');
        const control = host.locator('cms-dashboard-reorderable-field[name="options"]');
        await control.locator('p9r-input[data-item-field="label"] input').fill("Edited first");
        await control.getByRole("button", { name: "Add value", exact: true }).click();
        await control.locator('p9r-input[data-item-field="value"] input').nth(1).fill("second");
        await control.locator('p9r-input[data-item-field="label"] input').nth(1).fill("Second");
        const node = await control.elementHandle();
        const read = page.waitForResponse("**/getExtraField*");
        await host.getByRole("button", { name: "Save field", exact: true }).click();
        await read;
        expect(state.writes[0]!.body.options).toEqual([
            { id: "first", value: "first", label: "Edited first", position: 0 },
            { value: "second", label: "Second", position: 1 },
        ]);
        expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
        await control.locator("[data-remove]").last().click();
        await control.locator("[data-remove]").last().click();
        const refreshed = page.waitForResponse("**/getExtraField*");
        await host.getByRole("button", { name: "Save field", exact: true }).click();
        await refreshed;
        expect(state.writes[1]!.body.options).toEqual([]);
        expect(state.errors).toEqual([]);
    } finally {
        await context.close();
    }
}, 15000);
