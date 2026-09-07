import { expect, test } from "bun:test";
import { chromium, type Page } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installDashboardRoutes, runtime } from "./fixture";

const bundlePath = resolve(import.meta.dir, "../../../../src/static/assets/control-components.js");
const pagePath = resolve(import.meta.dir, "../../../../src/static/dashboards/index.html");
const stylesPath = resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css");

async function mount(page: Page, bundle = bundlePath): Promise<void> {
    await page.goto("http://cms.test/dashboards?id=support");
    await page.addStyleTag({ path: stylesPath });
    await page.addScriptTag({ path: bundle });
    await page.evaluate(
        (html) => {
            document.body.innerHTML = `<cms-binding-core>${html}</cms-binding-core>`;
        },
        await Bun.file(pagePath).text(),
    );
}

async function select(page: Page, id: string): Promise<void> {
    await page.evaluate((id) => {
        window.dispatchEvent(new CustomEvent("cms-dashboard-workspace:selected", { detail: { id } }));
    }, id);
}

async function scope(page: Page, id: string): Promise<void> {
    await page.waitForFunction((id) => document.documentElement.dataset.dashboardScope === id, id);
}

test("operator sources cancel stale failures, recover from errors and stop on disconnect", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await installDashboardRoutes(page);
        const reads: string[] = [];
        let fail = false;
        let hold: Promise<void> | undefined;
        await page.route("**/api/dashboard-session/dashboard?**", async (route) => {
            const id = new URL(route.request().url()).searchParams.get("id")!;
            reads.push(id);
            const failed = fail;
            if (id === "support") {
                await hold;
            }
            await route.fulfill(failed ? { status: 503, json: { error: "Unavailable" } } : { json: runtime(id) });
        });
        await mount(page);
        await scope(page, "support");
        expect(reads).toEqual(["support"]);
        let release!: () => void;
        hold = new Promise((resolve) => {
            release = resolve;
        });
        fail = true;
        const staleRead = page.waitForRequest("**/api/dashboard-session/dashboard?id=support");
        await select(page, "support");
        await staleRead;
        await page.waitForFunction(() => !document.documentElement.dataset.dashboardScope);
        fail = false;
        await select(page, "commerce");
        await scope(page, "commerce");
        release();
        await page.waitForLoadState("networkidle");
        expect(await page.locator("cms-dashboard-workspace [data-message]").isVisible()).toBeFalse();
        await scope(page, "commerce");
        fail = true;
        await select(page, "commerce");
        await page.locator("[data-message][data-error]").waitFor();
        expect(await page.locator("[data-message]").textContent()).toContain("503");
        fail = false;
        await select(page, "commerce");
        await scope(page, "commerce");
        hold = new Promise((resolve) => {
            release = resolve;
        });
        const disconnectedRead = page.waitForRequest("**/api/dashboard-session/dashboard?id=support");
        await select(page, "support");
        await disconnectedRead;
        await page.locator("cms-dashboard-workspace").evaluate((node) => node.remove());
        release();
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.dataset.dashboardScope)).toBeUndefined();
        const before = reads.length;
        await select(page, "commerce");
        await page.waitForTimeout(50);
        expect(reads).toHaveLength(before);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15_000);

test("bound operator reads preserve desktop and mobile layout", async () => {
    const browser = await chromium.launch();
    const captures = process.env.CMS_READS_CAPTURES;
    const baseline = process.env.CMS_READS_BASELINE;
    const before = new Map<number, number[]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ reducedMotion: "reduce" });
            await installDashboardRoutes(page);
            const started = performance.now();
            await mount(page, mode === "before" ? baseline : bundlePath);
            await scope(page, "support");
            const loadedMs = performance.now() - started;
            expect(loadedMs).toBeLessThan(5000);
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: 900 });
                await page.evaluate(
                    () =>
                        new Promise<void>((resolve) =>
                            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                        ),
                );
                const boxes = await page
                    .locator("cms-dashboard-workspace, cms-dashboard-nav, [data-view-navigation]")
                    .evaluateAll((nodes) =>
                        nodes.flatMap((node) => {
                            const box = node.getBoundingClientRect();
                            return [box.x, box.y, box.width, box.height];
                        }),
                    );
                if (mode === "before") {
                    before.set(width, boxes);
                } else if (baseline) {
                    expect(boxes).toEqual(before.get(width)!);
                }
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTrue();
                if (captures) {
                    await page.screenshot({
                        path: `${captures}/${mode}-operator-${width}.png`,
                        animations: "disabled",
                    });
                }
            }
            console.log(JSON.stringify({ mode, loadedMs }));
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 20_000);
