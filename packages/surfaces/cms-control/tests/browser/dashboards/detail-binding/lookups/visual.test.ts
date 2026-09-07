import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installLookupRoutes } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("remote lookup fields preserve their desktop/mobile presentation", async () => {
    const baseline = process.env.CMS_LOOKUP_BASELINE;
    const captures = process.env.CMS_LOOKUP_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const before = new Map<string, number[]>();
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                const page = await browser.newPage({
                    viewport: { width, height: width === 390 ? 844 : 1000 },
                    reducedMotion: "reduce",
                });
                page.setDefaultTimeout(5000);
                const fixture = await installLookupRoutes(
                    page,
                    mode === "before" ? await Bun.file(baseline!).text() : bundle,
                    styles,
                );
                const started = performance.now();
                await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
                const brand = page.locator('p9r-combobox[data-field-control="brand"]');
                await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
                const loadedMs = performance.now() - started;
                for (const state of ["closed", "open"]) {
                    if (state === "open") {
                        await brand.locator("input").focus();
                    }
                    await page.mouse.move(0, 0);
                    const geometry = await page.locator("[data-field-control]").evaluateAll((nodes) =>
                        nodes.flatMap((node) => {
                            const rect = node.getBoundingClientRect();
                            return [rect.x, rect.y, rect.width, rect.height];
                        }),
                    );
                    const key = `${width}-${state}`;
                    if (mode === "before") {
                        before.set(key, geometry);
                    } else if (baseline) {
                        expect(geometry).toEqual(before.get(key)!);
                    }
                    if (captures) {
                        await page.screenshot({ path: `${captures}/${mode}-${key}.png`, animations: "disabled" });
                    }
                }
                if (captures) {
                    console.info(JSON.stringify({ mode, width, loadedMs, reads: fixture.reads.length }));
                }
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
}, 25_000);
