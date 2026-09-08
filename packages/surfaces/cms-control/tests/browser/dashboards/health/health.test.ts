import { afterAll, beforeAll, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright";
import { mountHealthFixture } from "./fixture";
let browser: Browser;
beforeAll(async () => {
    browser = await chromium.launch();
});
afterAll(async () => {
    await browser.close();
});

test("health overview is read-only and equal refreshes retain summaries", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
        const { state, errors } = await mountHealthFixture(page, "<cms-health-page></cms-health-page>");
        await page.waitForFunction(() =>
            document
                .querySelector('cms-health-summary[installation-id="service"] strong')
                ?.textContent?.includes("degraded"),
        );
        expect(state.writes).toEqual([]);
        await page.evaluate(() => {
            (window as any).summary = document.querySelector("cms-health-summary");
        });
        const row = page.locator('cms-health-row[installation-id="service"]');
        await row.locator("summary").click();
        await row.locator("[data-sync-form]").waitFor();
        await row.locator("[data-upgrade-open]").scrollIntoViewIfNeeded();
        await page.evaluate(() => {
            (window as any).row = document.querySelector("cms-health-row");
        });
        const reads = state.healthReads;
        const scroll = await page.evaluate(() => window.scrollY);
        await page.locator("[data-health-refresh-all]").evaluate((node) => (node as HTMLElement).click());
        await page.waitForTimeout(300);
        expect(state.healthReads).toBeGreaterThan(reads);
        expect(Math.abs((await page.evaluate(() => window.scrollY)) - scroll)).toBeLessThanOrEqual(1);
        expect(
            await page.evaluate(() => (window as any).summary === document.querySelector("cms-health-summary")),
        ).toBe(true);
        expect(await row.locator("details").getAttribute("open")).not.toBeNull();
        expect(await page.evaluate(() => (window as any).row === document.querySelector("cms-health-row"))).toBe(true);
        expect(await page.locator("a").filter({ hasText: "View diagnostics" }).count()).toBe(0);
        expect(state.writes).toEqual([]);
        expect(errors).toEqual([]);
    } finally {
        await page.close();
    }
});

test("health actions own their modal forms; sync and upgrades live outside Sources", async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
    try {
        const { state, errors } = await mountHealthFixture(page, "<cms-health-page></cms-health-page>");
        await page.locator('cms-health-row[installation-id="service"] summary').click();
        await page.locator('[data-health-action="repair"]').waitFor();
        await page.locator('[data-health-action="repair"]').click();
        const modal = page.locator("p9r-modal[open]");
        await modal.locator("p9r-input input").fill("Reconnect");
        await modal.locator('p9r-button[type="submit"]').click();
        await page.waitForTimeout(250);
        expect(state.writes[0]).toEqual({
            path: "/api/integrations/management/action",
            body: { actionId: "repair", input: { reason: "Reconnect" } },
        });
        await page.locator("[data-upgrade-open]").click();
        await page.locator("[data-upgrade-form]").waitFor({ state: "visible" });
        await page.locator("[data-upgrade-confirm]").click();
        expect(state.writes).toHaveLength(1);
        await page.locator("[data-upgrade-confirmation] input").fill("1.1.0");
        await page.locator("[data-upgrade-confirm]").click();
        await page.waitForTimeout(250);
        expect(state.writes[1]).toEqual({
            path: "/api/integrations/installations/upgrade",
            body: { version: "1.1.0" },
        });
        await page.locator("[data-sync-form] p9r-button").click();
        await page.waitForTimeout(250);
        expect(state.writes[2]?.path).toBe("/api/integrations/installations/rerun");
        expect(errors).toEqual([]);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: "/tmp/cmscore-health-detail-mobile-e2e.png", fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
        await page.close();
    }
}, 30000);

test("a slow health observation does not block other installed services", async () => {
    const page = await browser.newPage();
    try {
        const { state, errors } = await mountHealthFixture(page, "<cms-health-page></cms-health-page>", 1500);
        await page.waitForFunction(() =>
            document
                .querySelector('cms-health-summary[installation-id="service"] strong')
                ?.textContent?.includes("degraded"),
        );
        expect(await page.locator('cms-health-summary[installation-id="slow"]').innerText()).toContain(
            "Checking service",
        );
        await page.waitForFunction(() =>
            document
                .querySelector('cms-health-summary[installation-id="slow"] strong')
                ?.textContent?.includes("degraded"),
        );
        expect(state.writes).toEqual([]);
        expect(errors).toEqual([]);
    } finally {
        await page.close();
    }
});

test("batch upgrades require review and stop on failure without replaying completed upgrades", async () => {
    const page = await browser.newPage();
    try {
        const { state, errors } = await mountHealthFixture(page, "<cms-health-page></cms-health-page>");
        await page.locator('cms-health-row[installation-id="service"]').waitFor();
        await page.locator("[data-health-upgrade-all]").click();
        const modal = page.locator("cms-health-upgrades p9r-modal[open]");
        await modal.getByText("2 upgrades available.", { exact: false }).waitFor();
        expect(state.writes).toEqual([]);
        expect(await modal.innerText()).toContain("1.0.0 → 1.1.0");
        await page.route("**/api/integrations/installations/upgrade?id=slow", async (route) => {
            state.writes.push({ path: "/failed-upgrade", body: route.request().postDataJSON() });
            await route.fulfill({ status: 503, json: { error: "Repository unavailable" } });
        });
        await modal.locator("[data-health-upgrade-confirm]").click();
        await modal.getByText("Stopped after an upgrade failed.", { exact: false }).waitFor();
        expect(state.writes.map((entry) => entry.body)).toEqual([{ version: "1.1.0" }, { version: "1.1.0" }]);
        expect(await modal.locator("[data-health-upgrade-confirm]").getAttribute("disabled")).not.toBeNull();
        expect(await modal.innerText()).toContain("Upgraded to 1.1.0");
        expect(errors).toEqual([]);
    } finally {
        await page.close();
    }
}, 30000);
