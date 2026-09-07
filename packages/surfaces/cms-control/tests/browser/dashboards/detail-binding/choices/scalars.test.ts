import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installReadonlyRoutes } from "../fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("checkboxes and amounts preserve layout, drafts, validation and typed values through repeated saves", async () => {
    const browser = await chromium.launch();
    try {
        const baseline = process.env.CMS_SCALARS_BASELINE;
        const captures = process.env.CMS_SCALARS_CAPTURES;
        const positions = new Map<number, Awaited<ReturnType<Locator["boundingBox"]>>[]>();
        if (captures) {
            await mkdir(captures, { recursive: true });
        }
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            const page = await browser.newPage({
                viewport: { width: 1440, height: 1000 },
                locale: "en-US",
                reducedMotion: "reduce",
            });
            page.setDefaultTimeout(5000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const fixture = await installReadonlyRoutes(
                page,
                mode === "before" ? await Bun.file(baseline!).text() : bundle,
                styles,
                {
                    resource: { enabled: false, accepted: true, price: 1299, whole: 1500, yen: 250, currency: "JPY" },
                    fields: [
                        { id: "enabled", label: "Enabled", path: "enabled", type: "checkbox" },
                        { id: "accepted", label: "Accepted", path: "accepted", type: "checkbox", required: true },
                        { id: "price", label: "Price", path: "price", type: "money", required: true },
                        { id: "whole", label: "Whole amount", path: "whole", type: "money", allowDecimals: false },
                        { id: "yen", label: "Yen", path: "yen", type: "money", currencyPath: "currency" },
                    ],
                },
            );
            const started = performance.now();
            await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
            const detail = page.locator("cms-dashboard-w-detail");
            const enabled = detail.getByRole("checkbox", { name: "Enabled", exact: true });
            const accepted = detail.getByRole("checkbox", { name: "Accepted", exact: true });
            const price = detail.locator('[data-field-control="price"] input');
            const whole = detail.locator('[data-field-control="whole"] input');
            const yen = detail.locator('[data-field-control="yen"] input');
            await price.waitFor();
            const loadedMs = performance.now() - started;
            expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(1);
            if (captures) {
                console.info(JSON.stringify({ mode, loadedMs, reads: 1 }));
            }
            expect(await enabled.isChecked()).toBe(false);
            expect(await accepted.isChecked()).toBe(true);
            expect(await price.inputValue()).toBe("12.99");
            expect(await whole.inputValue()).toBe("15");
            expect(await yen.inputValue()).toBe("250");
            for (const width of [1440, 390]) {
                await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
                const boxes = await Promise.all(
                    [detail, enabled, accepted, price, whole, yen].map((node) => node.boundingBox()),
                );
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
                    await detail
                        .locator("[data-field-control]")
                        .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
                ).toBe(true);
                const release = fixture.hold();
                const refreshed = page.waitForResponse((response) => response.url().endsWith("/item"));
                await detail.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
                await enabled.check();
                await price.fill("45,67");
                await price.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 3));
                release();
                await refreshed;
                await page.evaluate(
                    () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
                );
                expect(await enabled.isChecked()).toBe(true);
                expect(await price.inputValue()).toBe("45,67");
                expect(
                    await price.evaluate((node: HTMLInputElement) => [
                        node.getRootNode() instanceof ShadowRoot &&
                            (node.getRootNode() as ShadowRoot).activeElement === node,
                        node.selectionStart,
                        node.selectionEnd,
                    ]),
                ).toEqual([true, 1, 3]);
                await accepted.uncheck();
                const save = page.getByRole("button", { name: "Save choices", exact: true });
                await save.click();
                expect(fixture.saved).toHaveLength(0);
                expect(await accepted.getAttribute("aria-invalid")).toBe("true");
                await accepted.check();
                await price.fill("1.234");
                await save.click();
                expect(fixture.saved).toHaveLength(0);
                expect(await detail.locator('[data-field-control="price"]').getAttribute("invalid")).not.toBeNull();
                await price.fill("45,67");
                await whole.fill("20");
                await yen.fill("350");
                const readsBeforeSave = fixture.requests.filter((path) => path.endsWith("/item")).length;
                const saveStarted = performance.now();
                const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
                await save.click();
                await saved;
                expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(readsBeforeSave);
                if (captures) {
                    console.info(
                        JSON.stringify({
                            mode,
                            saveMs: performance.now() - saveStarted,
                            saveRequests: fixture.saved.length,
                            extraReads: 0,
                        }),
                    );
                }
                expect(fixture.saved).toEqual([{ enabled: true, accepted: true, price: 4567, whole: 2000, yen: 350 }]);
                await page.reload();
                await price.waitFor();
                expect(await enabled.isChecked()).toBe(true);
                expect(await price.inputValue()).toBe("45.67");
                expect(await whole.inputValue()).toBe("20");
                expect(await yen.inputValue()).toBe("350");
                await enabled.uncheck();
                await price.fill("0");
                const second = page.waitForResponse((response) => response.url().endsWith("/save"));
                await save.click();
                await second;
                await page.reload();
                await price.waitFor();
                expect(await enabled.isChecked()).toBe(false);
                expect(await price.inputValue()).toBe("0.00");
                expect(fixture.saved[1]).toEqual({ enabled: false, accepted: true, price: 0, whole: 2000, yen: 350 });
            }
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 25_000);
