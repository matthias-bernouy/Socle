import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { healthPage, installHealthRoutes } from "./fixture";
import { healthPosition } from "./stability";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("Health refresh retains bottom scroll and focus, coalesces double clicks and keeps the last report on failure", async () => {
    const browser = await chromium.launch();
    let releaseRead: (() => void) | undefined;
    const captures = process.env.CMS_HEALTH_REFRESH_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const fixture = await installHealthRoutes(page, bundle, styles);
            fixture.health!.report!.checks.push(
                ...Array.from({ length: 30 }, (_, index) => ({
                    id: `check-${index}`,
                    status: "ok" as const,
                    message: `Check ${index}`,
                    actionIds: ["repair"],
                })),
            );
            await page.goto(healthPage);
            const refresh = page.getByRole("button", { name: "Refresh health", exact: true });
            const last = page
                .locator('[data-check-id="check-29"]')
                .getByRole("button", { name: "Repair connection", exact: true });
            await last.waitFor();
            expect(fixture.reads).toHaveLength(1);
            releaseRead = fixture.holdRead();
            await refresh.dblclick();
            await page.waitForFunction(
                () => document.querySelector("[data-health-refresh]")?.getAttribute("aria-disabled") === "true",
            );
            await last.scrollIntoViewIfNeeded();
            await last.focus();
            const before = await healthPosition(last);
            expect(before.focus).toBe(true);
            expect(before.scrolls.some(([, top]) => top > 0) || before.window[1]! > 0).toBe(true);
            const original = await last.elementHandle();
            expect(fixture.reads).toHaveLength(2);
            if (captures) {
                await page.screenshot({ path: `${captures}/${width}-pending.png`, animations: "disabled" });
            }
            releaseRead();
            await page.waitForFunction(
                () => document.querySelector("[data-health-refresh]")?.getAttribute("aria-disabled") === "false",
            );
            for (let frame = 0; frame < 5; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
                expect(await healthPosition(last)).toEqual(before);
            }
            expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
            if (captures) {
                await page.screenshot({ path: `${captures}/${width}-refreshed.png`, animations: "disabled" });
            }
            fixture.failRead();
            await refresh.click();
            await page.getByRole("alert").filter({ hasText: "HTTP 503" }).waitFor();
            expect(await last.count()).toBe(1);
            expect(await page.getByText("Last observed service: degraded", { exact: true }).isVisible()).toBe(true);
            await refresh.click();
            await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
            expect(fixture.reads).toHaveLength(4);
            expect(fixture.reads.slice(1).every((url) => new URL(url).searchParams.get("refresh") === "true")).toBe(
                true,
            );
            expect(fixture.actions).toHaveLength(0);
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        releaseRead?.();
        await browser.close();
    }
}, 30000);
