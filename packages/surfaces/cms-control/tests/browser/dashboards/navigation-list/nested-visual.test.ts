import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installNestedRoutes } from "./nested-fixture";
const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("nested sections, tabs and detail navigation preserve their desktop/mobile layout", async () => {
    const baseline = process.env.CMS_NESTED_BASELINE;
    const captures = process.env.CMS_NESTED_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const before = new Map<string, number[]>();
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installNestedRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            const start = performance.now();
            await page.goto("http://cms.test/admin/sources?source=forms&dashboard=forms");
            const parent = page.locator('cms-dashboard-w-detail[data-widget-id="parent"]');
            await parent.locator("cms-dashboard-w-navigation-item").last().waitFor();
            await parent.locator('[data-field-control="name"] input').waitFor();
            const loadedMs = performance.now() - start;
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                for (const state of ["edit", "info"]) {
                    await page
                        .getByRole("tab", { name: state === "edit" ? "Edit" : "Information", exact: true })
                        .click();
                    if (state === "edit") {
                        await parent.locator('[data-field-control="name"] input').focus();
                    } else {
                        await page.getByText("Nested information", { exact: true }).waitFor();
                    }
                    await page.mouse.move(0, 0);
                    const nodes =
                        state === "edit"
                            ? parent.locator("[data-field-control], cms-dashboard-w-navigation-list")
                            : page.locator('cms-dashboard-w-detail[data-widget-id="info"]');
                    const positions = await nodes.evaluateAll((nodes) =>
                        nodes
                            .sort((left, right) =>
                                (
                                    left.getAttribute("data-field-control") ??
                                    left.getAttribute("data-widget-id") ??
                                    ""
                                ).localeCompare(
                                    right.getAttribute("data-field-control") ??
                                        right.getAttribute("data-widget-id") ??
                                        "",
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
            expect(fixture.reads.map((path) => path.split("/").at(-1)).sort()).toEqual(["children", "info", "parent"]);
            if (captures) {
                console.info(JSON.stringify({ mode, loadedMs, reads: fixture.reads }));
            }
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);

test("a pending parent keeps nested navigation hidden while independent reads run in parallel", async () => {
    const baseline = process.env.CMS_NESTED_BASELINE;
    const captures = process.env.CMS_NESTED_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installNestedRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            const release = fixture.holdParent();
            const children = page.waitForResponse((response) => response.url().endsWith("/children"));
            await page.goto("http://cms.test/admin/sources?source=forms&dashboard=forms");
            await children;
            const parent = page.locator('cms-dashboard-w-detail[data-widget-id="parent"]');
            const list = parent.locator("cms-dashboard-w-navigation-list");
            expect(await list.isVisible()).toBe(false);
            expect(await parent.locator('[data-field-control="name"]').count()).toBe(0);
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                if (captures) {
                    await page.screenshot({ path: `${captures}/${mode}-${width}-loading.png`, animations: "disabled" });
                }
            }
            release();
            await parent.locator('[data-field-control="name"]').waitFor();
            await list.locator("cms-dashboard-w-navigation-item").last().waitFor();
            expect(fixture.reads.filter((path) => path.endsWith("/children"))).toHaveLength(1);
            expect(fixture.reads.filter((path) => path.endsWith("/parent"))).toHaveLength(1);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 20_000);
