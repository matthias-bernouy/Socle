import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const bundle = resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js");
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("the example detail preserves its desktop/mobile layout and action menu", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_EXAMPLE_BASELINE;
    const captures = process.env.CMS_EXAMPLE_CAPTURES;
    const measurements = new Map<string, unknown>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
                page.setDefaultTimeout(5000);
                const requests: string[] = [];
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(error.message));
                await page.route("**/*", async (route) => {
                    const request = route.request();
                    const path = new URL(request.url()).pathname;
                    requests.push(path);
                    if (path === "/control.js") {
                        await route.fulfill({
                            contentType: "text/javascript",
                            body: await Bun.file(mode === "before" ? baseline! : bundle).text(),
                        });
                    } else if (path === "/style.css") {
                        await route.fulfill({ contentType: "text/css", body: styles });
                    } else if (request.resourceType() === "image") {
                        await route.fulfill({
                            contentType: "image/svg+xml",
                            body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#607d8b"/></svg>',
                        });
                    } else if (request.resourceType() === "document") {
                        await route.fulfill({
                            contentType: "text/html",
                            body: '<!doctype html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><cms-dashboards-admin example></cms-dashboards-admin></cms-binding-core></body>',
                        });
                    } else {
                        await route.fulfill({ status: 404, json: {} });
                    }
                });
                await page.goto("http://cms.test/admin/sources/example");
                const start = performance.now();
                await page.locator('[column="title"]').filter({ hasText: "Desk Lamp" }).click();
                const detail = page.locator("cms-dashboard-w-detail");
                await detail.locator('[data-field-control="title"] input').waitFor();
                const readyMs = performance.now() - start;
                await detail
                    .locator("img")
                    .first()
                    .evaluate((node) => (node as HTMLImageElement).decode());
                await page.mouse.move(0, 0);
                const positions = await detail.locator("[data-field-control]").evaluateAll((nodes) =>
                    nodes.map((node) => {
                        const { x, y, width, height } = node.getBoundingClientRect();
                        return { field: (node as HTMLElement).dataset.fieldControl, x, y, width, height };
                    }),
                );
                expect(await detail.locator(".add-tile, cms-dashboard-media-add button").count()).toBe(0);
                if (mode === "before") {
                    measurements.set(String(width), positions);
                } else if (baseline) {
                    expect(measurements.get(String(width))).toEqual(positions);
                }
                if (captures) {
                    await page.screenshot({
                        path: `${captures}/${mode}-${width}-ready.png`,
                        fullPage: true,
                        animations: "disabled",
                    });
                    console.info(JSON.stringify({ mode, width, readyMs, requests, positions }));
                }
                await detail.getByRole("button", { name: "More actions" }).click();
                await detail.getByRole("menuitem", { name: "Copy link" }).waitFor();
                if (captures) {
                    await page.screenshot({
                        path: `${captures}/${mode}-${width}-menu.png`,
                        fullPage: true,
                        animations: "disabled",
                    });
                }
                expect(requests.filter((path) => decodeURIComponent(path).includes("{{"))).toEqual([]);
                expect(errors).toEqual([]);
                expect(requests.filter((path) => path.startsWith("/api/") || path.startsWith("/.cms/"))).toEqual([]);
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
}, 20_000);
