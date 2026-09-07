import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installActionRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional action layout matches the original desktop/mobile UI", async () => {
    const baseline = process.env.CMS_ACTIONS_BASELINE;
    const captures = process.env.CMS_ACTIONS_CAPTURES;
    const before = new Map<string, number[]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installActionRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            const started = performance.now();
            await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
            const detail = page.locator("cms-dashboard-w-detail");
            const advanced = detail.getByRole("checkbox", { name: "Advanced", exact: true });
            await advanced.waitFor();
            await page.evaluate(
                () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
            );
            const loadedMs = performance.now() - started;
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                for (const state of ["basic", "advanced"]) {
                    await advanced.setChecked(state === "advanced");
                    if (state === "advanced") {
                        await detail.getByRole("button", { name: "More actions", exact: true }).click();
                        await detail.getByRole("menuitem", { name: "Remove", exact: true }).focus();
                    } else {
                        await detail.locator('[data-field-control="name"] input').focus();
                    }
                    await page.mouse.move(0, 0);
                    const positions = await detail
                        .locator(
                            "[data-field-control], p9r-button[data-action], p9r-action-menu, p9r-action-menu [data-panel]",
                        )
                        .evaluateAll((nodes) =>
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
                    if (state === "advanced") {
                        await detail.getByRole("menuitem", { name: "Remove", exact: true }).press("Escape");
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
