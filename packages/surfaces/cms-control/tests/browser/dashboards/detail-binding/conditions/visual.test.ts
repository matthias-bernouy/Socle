import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installConditionalRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional field states preserve desktop/mobile appearance and do not refetch their source", async () => {
    const browser = await chromium.launch();
    const before = new Map<string, number[]>();
    const baseline = process.env.CMS_CONDITIONS_BASELINE;
    const captures = process.env.CMS_CONDITIONS_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installConditionalRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            const started = performance.now();
            await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
            const detail = page.locator("cms-dashboard-w-detail");
            const choice = detail.locator('[data-field-control="mode"]');
            await page.waitForFunction(() => {
                const host = document.querySelector("cms-dashboard-w-detail");
                const control =
                    host?.querySelector('[data-field-control="mode"]') ??
                    host?.shadowRoot?.querySelector('[data-field-control="mode"]');
                return control instanceof HTMLElement && control.getBoundingClientRect().height > 0;
            });
            const loadedMs = performance.now() - started;
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                for (const state of ["basic", "advanced", "invalid"]) {
                    if (state === "invalid") {
                        await page.getByRole("button", { name: "Save choices", exact: true }).click();
                        expect(fixture.saved).toHaveLength(0);
                    } else {
                        await choice.getByRole("combobox").click();
                        await choice
                            .getByRole("option", { name: state === "basic" ? "Basic" : "Advanced", exact: true })
                            .click();
                    }
                    await detail
                        .locator(`[data-field-control="${state === "invalid" ? "note" : "name"}"] input`)
                        .focus();
                    await page.mouse.move(0, 0);
                    const positions = await detail.locator("[data-field-control]").evaluateAll((nodes) =>
                        nodes.flatMap((node) => {
                            const box = node.getBoundingClientRect();
                            return [box.x, box.y, box.width, box.height];
                        }),
                    );
                    const key = `${width}-${state}`;
                    if (mode === "before") {
                        before.set(key, positions);
                    } else if (baseline) {
                        const previous = before.get(key)!;
                        expect(positions).toHaveLength(previous.length);
                        expect(
                            Math.max(...positions.map((value, index) => Math.abs(value - previous[index]!))),
                        ).toBeLessThan(2);
                    }
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                    if (captures) {
                        await page.screenshot({ path: `${captures}/${mode}-${key}.png`, animations: "disabled" });
                    }
                }
            }
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(1);
            if (captures) {
                console.info(JSON.stringify({ mode, loadedMs, reads: 1 }));
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);
