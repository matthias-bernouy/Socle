import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { healthPage, initialHealth, installHealthRoutes } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("Health recovery retries without replacing its action or issuing duplicate operations", async () => {
    const browser = await chromium.launch();
    let releaseAction: (() => void) | undefined;
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installHealthRoutes(page, bundle, styles);
        await page.goto(healthPage);
        const repair = page.getByRole("button", { name: "Repair connection", exact: true });
        await repair.waitFor();
        const original = await repair.elementHandle();
        const position = await repair.boundingBox();
        fixture.failAction();
        releaseAction = fixture.holdAction();
        await repair.dblclick();
        expect(fixture.actions).toEqual(["repair"]);
        expect(await repair.boundingBox()).toEqual(position);
        expect(await repair.evaluate((node) => node.matches(":focus"))).toBe(true);
        releaseAction();
        await page.getByRole("status").filter({ hasText: "Repair temporarily unavailable" }).waitFor();
        expect(fixture.reads).toHaveLength(1);
        expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
        const refreshed = page.waitForResponse(
            (response) => response.url().includes("/management/health") && response.ok(),
        );
        await repair.click();
        await refreshed;
        await page.getByText("The saved configuration is applied.", { exact: true }).waitFor();
        expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await repair.evaluate((node) => node.matches(":focus"))).toBe(true);
        expect(fixture.actions).toEqual(["repair", "repair"]);
        expect(fixture.reads).toHaveLength(2);
        expect(fixture.connection.writes).toHaveLength(0);
        expect(await page.locator('[data-check-id="hooks"] strong').textContent()).toBe("ok · Webhooks need updating");
        expect(errors).toEqual([]);
    } finally {
        releaseAction?.();
        await browser.close();
    }
}, 20000);

test("a late Health observation cannot replace Connection after tab navigation", async () => {
    const browser = await chromium.launch();
    let release: (() => void) | undefined;
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installHealthRoutes(page, bundle, styles);
        release = fixture.holdRead();
        await page.goto(healthPage);
        await page.getByRole("button", { name: "Connection", exact: true }).click();
        await page.getByRole("button", { name: "Save settings", exact: true }).waitFor();
        release();
        await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        expect(await page.locator("[data-integration-health]").count()).toBe(0);
        expect(await page.getByRole("button", { name: "Save settings", exact: true }).isVisible()).toBe(true);
        expect(fixture.actions).toHaveLength(0);
        expect(errors).toEqual([]);
    } finally {
        release?.();
        await browser.close();
    }
}, 20000);

test("Health retries initial failures and empty observations without applying configuration", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installHealthRoutes(page, bundle, styles);
        fixture.failRead();
        fixture.setHealth(null);
        await page.goto(healthPage);
        await page.getByRole("alert").filter({ hasText: "HTTP 503" }).waitFor();
        const refresh = page.getByRole("button", { name: "Refresh health", exact: true });
        await refresh.click();
        await page.getByText("No valid service observation is available.", { exact: true }).waitFor();
        expect(await page.getByText("Loading…", { exact: true }).count()).toBe(0);
        expect(await page.getByRole("alert").count()).toBe(0);
        fixture.setHealth(initialHealth());
        await refresh.click();
        await page.getByText("Last observed service: degraded", { exact: true }).waitFor();
        expect(fixture.reads).toHaveLength(3);
        expect(fixture.actions).toHaveLength(0);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
