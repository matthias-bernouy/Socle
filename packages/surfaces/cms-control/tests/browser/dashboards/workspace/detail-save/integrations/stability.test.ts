import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";
import { cases } from "./definitions";
import { integrationFixture } from "./fixture";

let browser: Browser;
beforeAll(async () => {
    browser = await chromium.launch();
});
afterAll(async () => {
    await browser.close();
});

test("settings keep the draft, geometry and revision through conflict and a delayed retry", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    try {
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const entry = cases.find((item) => item.widget.id === "commerceSettings")!;
        const { state, url } = await integrationFixture(page, entry);
        await page.goto(url);
        const host = page.locator('cms-dashboard-w-detail[data-widget-id="commerceSettings"]');
        const input = host.locator('p9r-input[name="defaultCurrency"] input');
        await input.fill("EUR");
        const node = await input.elementHandle();
        const save = host.getByRole("button", { name: "Save settings", exact: true });
        await page.waitForLoadState("networkidle");
        const initialReads = state.reads;
        state.fail = true;
        const failure = page.waitForResponse("**/updateSettings");
        await save.click();
        expect((await failure).status()).toBe(409);
        expect(await input.inputValue()).toBe("EUR");
        expect(state.reads).toBe(initialReads);
        await page.waitForFunction(() => !document.querySelector('[data-detail-save][aria-busy="true"]'));
        let release!: () => void;
        state.pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        const requested = page.waitForRequest("**/updateSettings");
        await save.click();
        await requested;
        expect(state.writes).toHaveLength(2);
        expect(state.writes[1]!.body.expectedVersion).toBe(7);
        expect(state.writes[1]!.body.defaultCurrency).toBe("EUR");
        expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
        const box = await input.boundingBox();
        const read = page.waitForResponse("**/settings");
        release();
        await read;
        await page.waitForFunction(() => !document.querySelector('[data-detail-save][aria-busy="true"]'));
        expect(state.reads).toBe(initialReads + 1);
        expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
        expect(await input.boundingBox()).toEqual(box);
        expect(await host.locator('input[name="expectedVersion"]').inputValue()).toBe("8");
        expect(state.errors).toEqual([]);
    } finally {
        await context.close();
    }
}, 15000);

test("policy publishing retains confirmation and submits false boolean settings", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    try {
        const page = await context.newPage();
        const entry = cases.find((item) => item.widget.id === "protectedC2cPolicySettings")!;
        const { state, url } = await integrationFixture(page, entry);
        await page.goto(url);
        const save = page.getByRole("button", { name: entry.widget.save.label, exact: true });
        page.once("dialog", (dialog) => dialog.dismiss());
        await save.click();
        expect(state.writes).toEqual([]);
        page.once("dialog", (dialog) => dialog.accept());
        const read = page.waitForResponse("**/c2cPolicies");
        await save.click();
        await read;
        expect(state.writes[0]!.body.costEstimatesConfigured).toBe(false);
        expect(state.writes[0]!.body.subsidyOverride).toBe(false);
        expect(state.errors).toEqual([]);
    } finally {
        await context.close();
    }
}, 15000);
