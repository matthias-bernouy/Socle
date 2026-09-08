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

for (const entry of cases.filter((item) => item.widget.delete)) {
    test(`${entry.widget.id}: deletion confirms, sends its own identity and returns to the list`, async () => {
        const context = await browser.newContext();
        try {
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            const { state, url } = await integrationFixture(page, entry);
            await page.goto(url);
            const host = page.locator(`cms-dashboard-w-detail[data-widget-id="${entry.widget.id}"]`);
            const operation = entry.widget.delete;
            await host
                .locator('[slot="bound-actions"]')
                .getByRole("button", { name: operation.label, exact: true })
                .click();
            const modal = host.locator("p9r-modal[open]");
            expect(await page.locator("form form").count()).toBe(0);
            const response = page.waitForResponse((r) => r.url().endsWith(`/${operation.endpoint}`));
            await modal.getByRole("button", { name: operation.label, exact: true }).click();
            await response;
            await host.waitFor({ state: "detached" });
            expect(Object.keys(state.writes[0]!.body).sort()).toEqual(
                operation.hiddenFields.map((f: any) => f.name).sort(),
            );
            expect(state.writes[0]!.endpoint).toBe(operation.endpoint);
            expect(state.errors).toEqual([]);
        } finally {
            await context.close();
        }
    }, 15000);
}

for (const id of ["sendTestEmail", "archiveTemplate"]) {
    test(`template ${id} is independent from the principal form`, async () => {
        const context = await browser.newContext();
        try {
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            const entry = cases.find((item) => item.widget.id === "templateDetail")!;
            const action = entry.widget.actions.find((candidate: any) => candidate.id === id);
            const { state, url } = await integrationFixture(page, entry);
            await page.goto(url);
            const host = page.locator('cms-dashboard-w-detail[data-widget-id="templateDetail"]');
            const node = await host.elementHandle();
            await host
                .locator('[slot="bound-actions"]')
                .getByRole("button", { name: action.label, exact: true })
                .click();
            const modal = host.locator("p9r-modal[open]");
            if (id === "sendTestEmail") {
                await modal.getByRole("textbox", { name: /^Test recipient/ }).fill("qa@example.test");
            }
            const read = page.waitForResponse((r) => r.url().includes("/getTemplate"));
            await modal.getByRole("button", { name: action.label, exact: true }).click();
            await read;
            expect(state.writes[0]!.endpoint).toBe(action.form.endpoint);
            expect(state.writes[0]!.body).toEqual({
                key: state.resource.key,
                ...(id === "sendTestEmail" ? { toEmail: "qa@example.test" } : {}),
            });
            expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
            expect(state.errors).toEqual([]);
        } finally {
            await context.close();
        }
    }, 15000);
}
