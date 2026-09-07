import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installTableRoutes } from "./fixture";
const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("table headers, actions and filters preserve desktop/mobile layout", async () => {
    const baseline = process.env.CMS_TABLE_BASELINE;
    const captures = process.env.CMS_TABLE_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const before = new Map<string, number[]>();
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installTableRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            const start = performance.now();
            await page.goto("http://cms.test/admin/sources?source=store&dashboard=catalogue");
            const table = page.locator("cms-dashboard-w-table");
            await table.locator("cms-dashboard-w-row").last().waitFor();
            const loadedMs = performance.now() - start;
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                for (const state of ["all", "active"]) {
                    await table.locator('[data-filter-id="status"]').selectOption(state === "all" ? "" : "active");
                    const changed = state === "active" || width === 390;
                    const response = changed
                        ? page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/items"))
                        : undefined;
                    await table.getByRole("button", { name: "Apply filters", exact: true }).click();
                    await response;
                    await page.waitForFunction(
                        (count) => document.querySelectorAll("cms-dashboard-w-row").length === count,
                        state === "all" ? 3 : 2,
                    );
                    await table.locator('[data-filter-id="q"]').focus();
                    await page.mouse.move(0, 0);
                    const positions = await table
                        .locator("[data-filter-id], [data-column-header], p9r-button[data-action]")
                        .evaluateAll((nodes) =>
                            nodes
                                .sort((a, b) =>
                                    (a.hasAttribute("data-filter-id")
                                        ? `filter:${a.getAttribute("data-filter-id")}`
                                        : a.hasAttribute("data-column-header")
                                          ? `column:${a.getAttribute("data-column-header")}`
                                          : `action:${a.getAttribute("data-action")}`
                                    ).localeCompare(
                                        b.hasAttribute("data-filter-id")
                                            ? `filter:${b.getAttribute("data-filter-id")}`
                                            : b.hasAttribute("data-column-header")
                                              ? `column:${b.getAttribute("data-column-header")}`
                                              : `action:${b.getAttribute("data-action")}`,
                                    ),
                                )
                                .flatMap((node) => {
                                    const box = node.getBoundingClientRect();
                                    return [box.x, box.y, box.width, box.height];
                                }),
                        );
                    const key = `${width}-${state}`;
                    if (mode === "before") {
                        before.set(key, positions);
                    } else if (baseline) {
                        expect(positions).toEqual(before.get(key)!);
                    }
                    if (captures) {
                        await page.screenshot({ path: `${captures}/${mode}-${key}.png`, animations: "disabled" });
                    }
                }
            }
            if (captures) {
                console.info(JSON.stringify({ mode, loadedMs, reads: fixture.reads.length }));
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);
