import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installMediaRoutes, mediaPage } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("media grid, empty state and preview preserve desktop/mobile geometry", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_MEDIA_BASELINE;
    const captures = process.env.CMS_MEDIA_CAPTURES;
    const before = new Map<string, number[]>();
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                for (const state of ["grid", "preview", "empty"]) {
                    const page = await browser.newPage({
                        viewport: { width, height: width === 390 ? 844 : 1000 },
                        reducedMotion: "reduce",
                    });
                    page.setDefaultTimeout(5000);
                    const fixture = await installMediaRoutes(
                        page,
                        mode === "before" ? await Bun.file(baseline!).text() : bundle,
                        styles,
                    );
                    if (state === "empty") {
                        fixture.resource.photos = [];
                    }
                    const start = performance.now();
                    await page.goto(mediaPage);
                    const media = page.locator('[data-field-control="photos"]');
                    await media.getByRole("button", { name: "Add media", exact: true }).waitFor();
                    if (state === "preview") {
                        await media.getByRole("button", { name: "Preview", exact: true }).click();
                        await media.locator('[data-preview-image][data-state="ready"]').waitFor();
                    } else if (state === "grid") {
                        await page.waitForFunction(() => {
                            const host = document.querySelector("cms-dashboard-w-detail")!;
                            const media =
                                host.querySelector('[data-field-control="photos"]') ??
                                host.shadowRoot!.querySelector('[data-field-control="photos"]')!;
                            const images = [
                                ...Array.from(media.querySelectorAll("[data-media-tile] img")),
                                ...Array.from(
                                    media.shadowRoot!.querySelectorAll<HTMLImageElement>("[data-media-tile] img"),
                                ),
                            ];
                            return (
                                images.length === 3 &&
                                images.every(
                                    (image) =>
                                        (image as HTMLImageElement).complete &&
                                        (image as HTMLImageElement).naturalWidth > 0,
                                )
                            );
                        });
                    }
                    const loadedMs = performance.now() - start;
                    await page.mouse.move(0, 0);
                    const geometry: number[] = [];
                    for (const selector of ["[data-grid]", "[data-media-tile]", "[data-preview-dialog]"]) {
                        geometry.push(
                            ...(await media.locator(selector).evaluateAll((nodes) =>
                                nodes.flatMap((node) => {
                                    const box = node.getBoundingClientRect();
                                    return [box.x, box.y, box.width, box.height];
                                }),
                            )),
                        );
                    }
                    const key = `${width}-${state}`;
                    if (mode === "before") {
                        before.set(key, geometry);
                    } else if (baseline) {
                        expect(geometry).toEqual(before.get(key)!);
                    }
                    expect(await media.locator("[data-media-tile]").count()).toBe(state === "empty" ? 0 : 3);
                    expect(fixture.calls).toHaveLength(0);
                    if (captures) {
                        await page.screenshot({ path: `${captures}/${mode}-${key}.png`, animations: "disabled" });
                        console.info(
                            JSON.stringify({
                                mode,
                                width,
                                state,
                                loadedMs,
                                reads: fixture.requests.filter((path) => path.endsWith("/item")).length,
                                images: fixture.images.length,
                            }),
                        );
                    }
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
}, 30_000);
