import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installConnectionRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("integration connection fields preserve their presentation, canonical saves and retry behavior", async () => {
    const browser = await chromium.launch();
    const baseline = process.env.CMS_CONNECTION_BASELINE;
    const captures = process.env.CMS_CONNECTION_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    const geometry = new Map<number, number[][]>();
    try {
        for (const mode of baseline ? ["before", "after"] : ["after"]) {
            for (const width of [1440, 390]) {
                const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
                page.setDefaultTimeout(5000);
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(error.message));
                const fixture = await installConnectionRoutes(
                    page,
                    mode === "before" ? await Bun.file(baseline!).text() : bundle,
                    styles,
                );
                const start = performance.now();
                await page.goto("http://cms.test/admin/sources?integration=service");
                const field = page.locator('[data-field-control="country"] input');
                await field.waitFor();
                expect(await field.inputValue()).toBe("FR");
                const readyMs = performance.now() - start;
                const positions = await page.locator("[data-field-control]").evaluateAll((nodes) =>
                    nodes.map((node) => {
                        const box = node.getBoundingClientRect();
                        return [box.x, box.y, box.width, box.height];
                    }),
                );
                if (mode === "before") {
                    geometry.set(width, positions);
                } else if (baseline) {
                    // Feedback now reserves a line so the first save does not move the editor.
                    const feedbackSpace = await page.locator("[data-management-status]").evaluate((node) => {
                        const style = getComputedStyle(node);
                        return Number.parseFloat(style.lineHeight) + Number.parseFloat(style.marginBottom);
                    });
                    expect(positions).toEqual(
                        geometry.get(width)!.map(([x, y, width, height]) => [x!, y! + feedbackSpace, width!, height!]),
                    );
                }
                if (captures) {
                    await page.screenshot({ path: `${captures}/${mode}-${width}.png`, animations: "disabled" });
                    console.info(
                        JSON.stringify({ mode, width, readyMs, requests: fixture.requests.length, positions }),
                    );
                }
                if (mode === "after") {
                    expect(
                        await page
                            .locator("cms-dashboard-w-detail [data-field-control]")
                            .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
                    ).toBe(true);
                }
                const save = page.getByRole("button", { name: "Save settings", exact: true });
                await field.fill("");
                await save.click();
                expect(fixture.writes).toHaveLength(0);
                await field.fill("be");
                fixture.failSave();
                await save.click();
                await page.getByRole("status").filter({ hasText: "Please retry this save." }).waitFor();
                expect(await field.inputValue()).toBe("be");
                const saved = page.waitForResponse(
                    (response) =>
                        response.url().includes("/management/settings") &&
                        response.request().method() === "POST" &&
                        response.status() === 200,
                );
                await save.click();
                await saved;
                await page.getByRole("status").filter({ hasText: "Settings saved." }).waitFor();
                expect(await field.inputValue()).toBe("BE");
                expect(fixture.settings().values.metadata).toEqual({ keep: true });
                await page.reload();
                await field.waitFor();
                expect(await field.inputValue()).toBe("BE");
                await page.getByRole("button", { name: "Health", exact: true }).click();
                await page.getByText("No valid service observation", { exact: false }).waitFor();
                expect(fixture.writes).toHaveLength(2);
                expect(errors).toEqual([]);
                await page.close();
            }
        }
    } finally {
        await browser.close();
    }
}, 30000);
