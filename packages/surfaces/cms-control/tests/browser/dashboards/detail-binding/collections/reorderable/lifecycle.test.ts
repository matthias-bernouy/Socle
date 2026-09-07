import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installReorderableRoutes, reorderablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("slow choice options and saves retain newer drafts, focus, selection, card expansion and mobile scroll", async () => {
    const browser = await chromium.launch();
    try {
        for (const layout of ["rows", "cards"] as const) {
            for (const width of [1440, 390]) {
                const page = await browser.newPage({ viewport: { width, height: 700 } });
                page.setDefaultTimeout(5000);
                const fixture = await installReorderableRoutes(page, bundle, styles, layout);
                const releaseLookup = fixture.holdLookup();
                let releaseSave = () => {};
                try {
                    await page.goto(reorderablePage);
                    const rows = page.locator('[data-field-control="choices"] .row[data-index]');
                    const label = rows.last().locator('[data-item-field="label"] input');
                    if (layout === "cards") {
                        await rows.last().locator("summary").click();
                    }
                    await label.fill("Draft while options load");
                    await label.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 7));
                    const snapshot = async () => ({
                        input: await label.evaluate((node: HTMLInputElement) => ({
                            value: node.value,
                            focused: node.matches(":focus"),
                            start: node.selectionStart,
                            end: node.selectionEnd,
                        })),
                        box: await label.boundingBox(),
                        notes: await page.locator('[data-field-control="notes"]').boundingBox(),
                        scroll: await page.locator("w13c-left-menu-layout main").evaluate((node) => node.scrollTop),
                        nav: await page.locator("cms-dashboards-nav").boundingBox(),
                        expanded: await rows.locator("details[open]").count(),
                    });
                    const beforeLookup = await snapshot();
                    expect(beforeLookup.input.focused).toBe(true);
                    if (layout === "cards" && width === 390) {
                        expect(beforeLookup.scroll).toBeGreaterThan(0);
                    }
                    releaseLookup();
                    await rows.first().locator('option[value="head"]').waitFor({ state: "attached" });
                    expect(await snapshot()).toEqual(beforeLookup);
                    releaseSave = fixture.holdSave();
                    const request = page.waitForRequest((value) => value.url().endsWith("/save"));
                    const response = page.waitForResponse((value) => value.url().endsWith("/save"));
                    await page.getByRole("button", { name: "Save choices", exact: true }).click();
                    await request;
                    await label.fill("Newer draft while saving");
                    await label.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 6));
                    const beforeSave = await snapshot();
                    releaseSave();
                    expect((await response).ok()).toBe(true);
                    for (let frame = 0; frame < 5; frame += 1) {
                        await page.evaluate(
                            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
                        );
                        expect(await snapshot()).toEqual(beforeSave);
                    }
                    expect(
                        (fixture.saved[0]!.choices as Array<{ metadata: { label: string } }>)[1]!.metadata.label,
                    ).toBe("Draft while options load");
                    const second = page.waitForResponse((value) => value.url().endsWith("/save"));
                    await page.getByRole("button", { name: "Save choices", exact: true }).click();
                    await second;
                    expect(fixture.lookups).toHaveLength(1);
                    await page.reload();
                    await label.waitFor();
                    expect(await label.inputValue()).toBe("Newer draft while saving");
                    expect(fixture.resource.choices[1]!.metadata.label).toBe("Newer draft while saving");
                } finally {
                    releaseLookup();
                    releaseSave();
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }
}, 25_000);
