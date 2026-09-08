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

for (const entry of cases.filter((item) => item.widget.create)) {
    test(`${entry.widget.id}: first save creates, navigates to the returned identity, and rereads`, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
        try {
            const page = await context.newPage();
            page.setDefaultTimeout(5000);
            const { state, url } = await integrationFixture(page, entry, true);
            await page.goto(url);
            const host = page.locator(`cms-dashboard-w-detail[data-widget-id="${entry.widget.id}"]`);
            await host.locator("cms-detail-section").first().waitFor({ state: "visible" });
            for (const name of ["code", "key"]) {
                const input = host.locator(`p9r-input[name="${name}"] input`);
                if (await input.count()) {
                    await input.fill("created-key");
                }
            }
            expect(
                await host
                    .locator('[slot="bound-actions"]')
                    .getByRole("button", { name: /^Delete/ })
                    .count(),
            ).toBe(0);
            const read = page.waitForResponse((response) =>
                response.url().includes(`/${entry.widget.source.endpoint}`),
            );
            await host
                .locator('[slot="bound-actions"]')
                .getByRole("button", { name: entry.widget.save.label, exact: true })
                .click();
            await read;
            await page.waitForURL((current) => current.searchParams.get("row") !== "__new__");
            const identity = entry.widget.save.idPath
                .split(".")
                .reduce(
                    (value: any, key: string) => value[key],
                    entry.widget.source.itemPath ? { [entry.widget.source.itemPath]: state.resource } : state.resource,
                );
            expect(new URL(page.url()).searchParams.get("row")).toBe(String(identity));
            expect(state.writes).toHaveLength(1);
            expect(state.reads).toBe(2);
            expect(state.errors).toEqual([]);
        } finally {
            await context.close();
        }
    }, 15000);
}
