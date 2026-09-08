import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installNavigationRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("navigation list binds its rows, preserves its layout and persists drag ordering through reloads", async () => {
    const browser = await chromium.launch();
    try {
        const baseline = process.env.CMS_NAVIGATION_BASELINE;
        const captures = process.env.CMS_NAVIGATION_CAPTURES;
        const positions = new Map<number, Awaited<ReturnType<import("playwright").Locator["boundingBox"]>>[]>();
        if (captures) {
            await mkdir(captures, { recursive: true });
        }
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(6000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const fixture = await installNavigationRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
            );
            await page.goto("http://cms.test/admin/sources?source=fields&dashboard=fields");
            const list = page.locator("cms-dashboard-w-navigation-list");
            const rows = list.locator("cms-dashboard-w-navigation-item");
            await rows.last().waitFor();
            expect(await rows.count()).toBe(3);
            expect(await list.getByRole("button", { name: "Reorder", exact: true }).count()).toBe(0);
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                const boxes = [
                    await list.boundingBox(),
                    await list.getByRole("button", { name: "Add field", exact: true }).boundingBox(),
                ];
                if (mode === "before") {
                    positions.set(width, boxes);
                } else if (baseline) {
                    expect(boxes).toEqual(positions.get(width)!);
                }
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
                if (captures) {
                    await page.screenshot({ path: `${captures}/${mode}-${width}.png` });
                }
            }
            if (mode === "after") {
                expect(
                    await list
                        .locator('p9r-button[slot="actions"]')
                        .evaluateAll(
                            (nodes) => nodes.length === 2 && nodes.every((node) => node.getRootNode() === document),
                        ),
                ).toBe(true);
                const initialReads = fixture.counts().reads;
                const initialBox = await list.boundingBox();
                fixture.hold();
                const response = page.waitForResponse((result) => result.url().endsWith("/reorder"));
                const request = page.waitForRequest((result) => result.url().endsWith("/reorder"));
                await rows.first().locator("[data-handle]").dragTo(rows.last());
                await request;
                expect(fixture.orders).toEqual([["club", "region", "agency"]]);
                expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("row-key")))).toEqual(
                    fixture.orders[0]!,
                );
                expect(fixture.counts().reads).toBe(initialReads);
                expect(await list.boundingBox()).toEqual(initialBox);
                const refreshed = page.waitForResponse((result) => result.url().endsWith("/list"));
                fixture.release();
                await response;
                await refreshed;
                await page.evaluate(
                    () =>
                        new Promise<void>((resolve) =>
                            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
                        ),
                );
                expect(fixture.counts().reads).toBe(initialReads + 1);
                expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("row-key")))).toEqual(
                    fixture.orders[0]!,
                );
                expect(await list.boundingBox()).toEqual(initialBox);
                await page.reload();
                await rows.last().waitFor();
                expect(await rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("row-key")))).toEqual(
                    fixture.orders[0]!,
                );
                expect(await rows.count()).toBe(3);
                await rows.first().getByRole("button").click();
                await page.locator('cms-dashboard-w-detail [data-field-control="label"] input').waitFor();
                await page.getByRole("button", { name: "Back to table", exact: true }).click();
                await rows.last().waitFor();
                page.once("dialog", (dialog) => dialog.dismiss());
                await list.getByRole("button", { name: "Clear fields", exact: true }).click();
                expect(fixture.counts().clears).toBe(0);
                page.once("dialog", (dialog) => dialog.accept());
                await list.getByRole("button", { name: "Clear fields", exact: true }).click();
                await list.getByText("No items.", { exact: true }).waitFor();
                expect(fixture.counts().clears).toBe(1);
                expect(await rows.count()).toBe(0);
                await list.getByRole("button", { name: "Add field", exact: true }).click();
                await page.locator('cms-dashboard-w-detail [data-field-control="label"] input').waitFor();
                expect(
                    await page.locator('cms-dashboard-w-detail [data-field-control="label"] input').inputValue(),
                ).toBe("");
            }
            expect(errors).toEqual([]);
            fixture.release();
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 30_000);
