import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installReorderableRoutes, reorderablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();
type Geometry = { x: number; y: number; width: number; height: number; scrollWidth: number };

test("reorderable rows/cards retain desktop/mobile geometry in ready, empty, pending and expanded states", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_REORDERABLE_BASELINE;
    const captures = process.env.CMS_REORDERABLE_CAPTURES;
    const measurements = new Map<string, Geometry[][]>();
    const bottomMeasurements = new Map<string, unknown>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const layout of ["rows", "cards"] as const) {
                for (const width of [1440, 390]) {
                    for (const state of layout === "cards"
                        ? ["ready", "empty", "pending", "expanded"]
                        : ["ready", "empty", "pending"]) {
                        const page = await browser.newPage({
                            viewport: { width, height: width === 390 ? 844 : 1100 },
                            reducedMotion: "reduce",
                        });
                        page.setDefaultTimeout(5000);
                        const errors: string[] = [];
                        page.on("pageerror", (error) => errors.push(error.message));
                        const fixture = await installReorderableRoutes(
                            page,
                            mode === "before" ? await Bun.file(baseline!).text() : bundle,
                            styles,
                            layout,
                        );
                        if (state === "empty") {
                            fixture.resource.choices = [];
                        }
                        const release = state === "pending" ? fixture.holdLookup() : undefined;
                        try {
                            const start = performance.now();
                            await page.goto(reorderablePage);
                            const list = page.locator('[data-field-control="choices"]');
                            await list.getByRole("button", { name: "Add choice", exact: true }).waitFor();
                            if (state === "ready" || state === "expanded") {
                                await list.locator('option[value="head"]').first().waitFor({ state: "attached" });
                            }
                            const readyMs = performance.now() - start;
                            if (state === "expanded") {
                                await list.locator("summary").first().click();
                            }
                            const positions = [];
                            for (const selector of ["[data-field-control]", ".row[data-index]", "cms-dashboards-nav"]) {
                                positions.push(
                                    await page.locator(selector).evaluateAll((nodes) =>
                                        nodes.map((node) => {
                                            const box = node.getBoundingClientRect();
                                            return {
                                                x: box.x,
                                                y: box.y,
                                                width: box.width,
                                                height: box.height,
                                                scrollWidth: node.scrollWidth,
                                            };
                                        }),
                                    ),
                                );
                            }
                            const key = `${layout}-${width}-${state}`;
                            if (mode === "before") {
                                measurements.set(key, positions);
                            } else if (baseline) {
                                expect(positions).toEqual(measurements.get(key)!);
                            }
                            expect(fixture.saved).toHaveLength(0);
                            expect(errors).toEqual([]);
                            if (captures) {
                                await page.screenshot({
                                    path: `${captures}/${mode}-${key}.png`,
                                    fullPage: true,
                                    animations: "disabled",
                                });
                                console.info(
                                    JSON.stringify({
                                        mode,
                                        layout,
                                        width,
                                        state,
                                        readyMs,
                                        lookupReads: fixture.lookups.length,
                                        detailReads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                                        positions,
                                    }),
                                );
                            }
                            if (width === 390 && state === "ready") {
                                const toolbar = page.locator("w13c-left-menu-layout .mobile-toolbar");
                                const navigation = await toolbar.boundingBox();
                                const main = page.locator("w13c-left-menu-layout main");
                                await main.evaluate((node) => {
                                    node.scrollTop = node.scrollHeight;
                                });
                                const bottom = {
                                    scroll: await main.evaluate((node) => node.scrollTop),
                                    notes: await page.locator('[data-field-control="notes"]').boundingBox(),
                                    toolbar: await toolbar.boundingBox(),
                                };
                                expect(bottom.scroll).toBeGreaterThan(0);
                                expect(bottom.toolbar).toEqual(navigation);
                                expect(bottom.notes!.y + bottom.notes!.height).toBeLessThanOrEqual(844);
                                expect(
                                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                                ).toBe(true);
                                if (mode === "before") {
                                    bottomMeasurements.set(key, bottom);
                                } else if (baseline) {
                                    expect(bottomMeasurements.get(key)).toEqual(bottom);
                                }
                                if (captures) {
                                    await page.screenshot({
                                        path: `${captures}/${mode}-${layout}-390-bottom.png`,
                                        animations: "disabled",
                                    });
                                    console.info(JSON.stringify({ mode, layout, state: "bottom", bottom }));
                                }
                            }
                        } finally {
                            release?.();
                            await page.close();
                        }
                    }
                }
            }
        }
    } finally {
        await browser.close();
    }
}, 35_000);
