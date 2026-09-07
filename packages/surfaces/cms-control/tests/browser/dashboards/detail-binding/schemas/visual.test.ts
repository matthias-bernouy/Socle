import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installSchemaRoutes, schemaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("dynamic schema preserves desktop/mobile ready, loading, empty and error layouts", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_SCHEMA_BASELINE;
    const captures = process.env.CMS_SCHEMA_CAPTURES;
    const positions = new Map<string, number[]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                for (const state of ["ready", "loading", "empty", "error"]) {
                    const page = await browser.newPage({
                        viewport: { width, height: width === 390 ? 844 : 1100 },
                        reducedMotion: "reduce",
                    });
                    page.setDefaultTimeout(5000);
                    const fixture = await installSchemaRoutes(
                        page,
                        mode === "before" ? await Bun.file(baseline!).text() : bundle,
                        styles,
                    );
                    if (state === "empty") {
                        fixture.resource.category = "empty";
                    }
                    if (state === "error") {
                        fixture.failSchema();
                    }
                    const release = state === "loading" ? fixture.holdSchema() : undefined;
                    const start = performance.now();
                    await page.goto(schemaPage);
                    const schema = page.locator('[data-field-control="metadata"]');
                    if (state === "ready") {
                        await schema.locator('[data-schema-key="weight"] input').waitFor();
                    } else {
                        await schema
                            .getByText(
                                state === "loading"
                                    ? "Loading dynamic fields…"
                                    : state === "empty"
                                      ? "No dynamic fields are configured."
                                      : "Dynamic fields are temporarily unavailable. Existing values are preserved.",
                                { exact: true },
                            )
                            .waitFor();
                    }
                    const readyMs = performance.now() - start;
                    const geometry: number[] = [];
                    for (const node of [
                        schema,
                        schema.locator("[data-schema-key]"),
                        page.locator('[data-field-control="notes"]'),
                        page.locator("cms-dashboards-nav"),
                    ]) {
                        geometry.push(
                            ...(await node.evaluateAll((nodes) =>
                                nodes.flatMap((node) => {
                                    const box = node.getBoundingClientRect();
                                    return [box.x, box.y, box.width, box.height];
                                }),
                            )),
                        );
                    }
                    const key = `${width}-${state}`;
                    if (mode === "before") {
                        positions.set(key, geometry);
                    } else if (baseline) {
                        expect(geometry).toEqual(positions.get(key)!);
                    }
                    expect(fixture.saved).toHaveLength(0);
                    expect(fixture.schemas).toHaveLength(1);
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
                                schemaReads: fixture.schemas.length,
                                detailReads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                            }),
                        );
                    }
                    if (width === 390 && state === "ready") {
                        const main = page.locator("w13c-left-menu-layout main");
                        await main.evaluate((node) => {
                            node.scrollTop = node.scrollHeight;
                        });
                        const scroll = await main.evaluate((node) => node.scrollTop);
                        expect(scroll).toBeGreaterThan(0);
                        const notes = await page.locator('[data-field-control="notes"]').boundingBox();
                        const bottom = [scroll, notes!.x, notes!.y, notes!.width, notes!.height];
                        if (mode === "before") {
                            positions.set("mobile-bottom", bottom);
                        } else if (baseline) {
                            expect(bottom).toEqual(positions.get("mobile-bottom")!);
                        }
                        if (captures) {
                            await page.screenshot({
                                path: `${captures}/${mode}-390-bottom.png`,
                                animations: "disabled",
                            });
                        }
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
