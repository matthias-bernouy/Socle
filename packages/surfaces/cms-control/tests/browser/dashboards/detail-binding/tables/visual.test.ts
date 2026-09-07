import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installTableRoutes, tablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

type Geometry = { x: number; y: number; width: number; height: number; scrollWidth: number; clientWidth: number };

test("embedded table desktop/mobile references cover ready, empty and pending lookup states", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_TABLE_BASELINE;
    const captures = process.env.CMS_TABLE_CAPTURES;
    const measurements = new Map<string, Geometry[][]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                for (const state of ["ready", "empty", "pending"]) {
                    const page = await browser.newPage({
                        viewport: { width, height: width === 390 ? 844 : 1100 },
                        reducedMotion: "reduce",
                    });
                    page.setDefaultTimeout(5000);
                    const errors: string[] = [];
                    page.on("pageerror", (error) => errors.push(error.message));
                    const fixture = await installTableRoutes(
                        page,
                        mode === "before" ? await Bun.file(baseline!).text() : bundle,
                        styles,
                    );
                    if (state === "empty") {
                        fixture.resource.axes = [];
                        fixture.resource.matrix = [];
                        fixture.resource.prices = [];
                    }
                    const release = state === "pending" ? fixture.holdLookup() : undefined;
                    const start = performance.now();
                    await page.goto(tablePage);
                    const axes = page.locator('[data-field-control="axes"]');
                    await axes.getByRole("button", { name: "Add axis", exact: true }).waitFor();
                    if (state === "ready") {
                        await axes.locator('option[value="head"]').first().waitFor({ state: "attached" });
                    }
                    const readyMs = performance.now() - start;
                    const positions = [];
                    for (const selector of ["[data-field-control]", "[data-table-row]", "cms-dashboards-nav"]) {
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
                                        clientWidth: node.clientWidth,
                                    };
                                }),
                            ),
                        );
                    }
                    const key = `${width}-${state}`;
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
                                width,
                                state,
                                readyMs,
                                lookupReads: fixture.lookups.length,
                                detailReads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                                positions,
                            }),
                        );
                    }
                    release?.();
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
}, 30_000);
