import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { aliceLabel, installUserRoutes } from "./users.fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("shared CMS directory fields preserve desktop/mobile loaded and error layouts", async () => {
    const baseline = process.env.CMS_USER_BASELINE;
    const captures = process.env.CMS_USER_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const before = new Map<string, number[]>();
    const browser = await chromium.launch();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                for (const state of ["loaded", "error"]) {
                    const page = await browser.newPage({
                        viewport: { width, height: width === 390 ? 844 : 1000 },
                        reducedMotion: "reduce",
                    });
                    page.setDefaultTimeout(5000);
                    const fixture = await installUserRoutes(
                        page,
                        mode === "before" ? await Bun.file(baseline!).text() : bundle,
                        styles,
                        true,
                    );
                    if (state === "error") {
                        fixture.fail();
                    }
                    const start = performance.now();
                    await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
                    const user = page.locator('[data-field-control="user"]');
                    if (state === "loaded") {
                        await user.locator("option").filter({ hasText: aliceLabel }).waitFor({ state: "attached" });
                    } else {
                        await page.waitForFunction(
                            () =>
                                document
                                    .querySelector("cms-dashboard-w-detail")
                                    ?.shadowRoot?.querySelector('[data-field-control="user"][invalid]') ||
                                document.querySelector('[data-field-control="user"][invalid]'),
                        );
                    }
                    const loadedMs = performance.now() - start;
                    await page.mouse.move(0, 0);
                    const geometry = await page.locator("[data-field-control]").evaluateAll((nodes) =>
                        nodes.flatMap((node) => {
                            const box = node.getBoundingClientRect();
                            return [box.x, box.y, box.width, box.height];
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
                        console.info(JSON.stringify({ mode, width, state, loadedMs, reads: fixture.reads() }));
                    }
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
}, 25_000);
