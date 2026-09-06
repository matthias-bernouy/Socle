import { installReadonlyRoutes } from "./fixture";
import { checkRefreshStability } from "./stability";
import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("readonly binding preserves desktop/mobile layout, loads images and keeps edits stable on refresh", async () => {
    const browser = await chromium.launch();
    const captures = process.env.CMS_DASHBOARD_CAPTURES;
    const baseline = process.env.CMS_DASHBOARD_BASELINE;
    const before = new Map<string, number[]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(6000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const script = mode === "before" ? await Bun.file(baseline!).text() : bundle;
            const fixture = await installReadonlyRoutes(page, script, styles);
            const requests = fixture.requests;
            const started = performance.now();
            await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
            const detail = page.locator("cms-dashboard-w-detail");
            await detail.locator('img[alt="image"]').waitFor();
            await page.waitForFunction(() => {
                const host = document.querySelector("cms-dashboard-w-detail")!;
                const image = host.querySelector("img") ?? host.shadowRoot!.querySelector("img");
                return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
            });
            const loadedMs = performance.now() - started;
            expect(requests.filter((path) => path.endsWith("/item"))).toHaveLength(1);
            expect(requests.filter((path) => path === "/example.svg")).toHaveLength(1);
            expect(await detail.locator("li").allTextContents()).toEqual(["First", "Second"]);
            if (mode === "after") {
                expect(await detail.locator("cms-dashboard-detail-field").count()).toBe(8);
                expect(await detail.locator('[cms-bind-value="dashboardData"]').count()).toBe(0);
            }
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                const positions = await detail
                    .locator('[data-field-control="title"], .readonly-list, .readonly-empty, .badge, .detail-image')
                    .evaluateAll((nodes) =>
                        nodes.flatMap((node) => {
                            const rect = node.getBoundingClientRect();
                            return [rect.x, rect.y, rect.width, rect.height];
                        }),
                    );
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                if (mode === "before") {
                    before.set(String(width), positions);
                } else if (baseline) {
                    const previous = before.get(String(width))!;
                    expect(positions.length).toBe(previous.length);
                    expect(
                        Math.max(...positions.map((value, index) => Math.abs(value - previous[index]!))),
                    ).toBeLessThan(2);
                }
                if (captures) {
                    await page.screenshot({ path: `${captures}/${mode}-readonly-${width}.png`, fullPage: true });
                }
            }
            if (mode === "after") {
                await checkRefreshStability(page, fixture.hold);
            }
            expect(errors).toEqual([]);
            console.log(JSON.stringify({ mode, loadedMs, requests }));
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 30_000);
