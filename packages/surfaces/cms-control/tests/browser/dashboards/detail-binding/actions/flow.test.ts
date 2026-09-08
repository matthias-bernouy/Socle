import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installActionRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional action groups promote buttons, preserve open-menu focus and confirm persisted changes", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installActionRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const detail = page.locator("cms-dashboard-w-detail");
        const advanced = detail.getByRole("checkbox", { name: "Advanced", exact: true });
        const menu = detail.locator("p9r-action-menu");
        const buttons = detail.locator("p9r-button[data-action]");
        await advanced.waitFor();
        expect(await detail.getAttribute("data-declarative")).not.toBeNull();
        expect(await buttons.allTextContents()).toEqual(["Refresh", "Export"]);
        expect(await menu.count()).toBe(0);
        await advanced.check();
        expect(await buttons.allTextContents()).toEqual(["Review", "Refresh", "Export"]);
        await menu.getByRole("button", { name: "More actions" }).click();
        expect(
            await menu
                .locator("p9r-action-menu-section")
                .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("label"))),
        ).toEqual(["Maintenance", "Exports"]);
        expect(
            await menu
                .locator("p9r-action-menu-item")
                .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim())),
        ).toEqual(["Archive", "Remove", "Preview"]);
        expect(await menu.locator('svg[slot="icon"]').count()).toBe(3);
        const remove = menu.getByRole("menuitem", { name: "Remove", exact: true });
        await remove.focus();
        const original = await remove.elementHandle();
        const box = await detail.boundingBox();
        const menuBox = await menu.locator("[data-panel]").boundingBox();
        const navigation = page.locator("cms-dashboards-nav");
        const navigationBox = await navigation.boundingBox();
        const release = fixture.hold();
        const reading = page.waitForRequest((request) => request.url().endsWith("/item"));
        const refreshed = page.waitForResponse((response) => response.url().endsWith("/item"));
        await detail.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
        await reading;
        try {
            for (let frame = 0; frame < 5; frame += 1) {
                await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
                expect(await menu.getAttribute("open")).not.toBeNull();
                expect(await detail.boundingBox()).toEqual(box);
                expect(await menu.locator("[data-panel]").boundingBox()).toEqual(menuBox);
                expect(await navigation.boundingBox()).toEqual(navigationBox);
                expect(await remove.evaluate((node) => (node.getRootNode() as ShadowRoot).activeElement === node)).toBe(
                    true,
                );
            }
        } finally {
            release();
        }
        await refreshed;
        await page.evaluate(
            () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
        );
        expect(await detail.boundingBox()).toEqual(box);
        expect(await remove.evaluate((node, previous) => node === previous, original)).toBe(true);
        expect(await remove.evaluate((node) => (node.getRootNode() as ShadowRoot).activeElement === node)).toBe(true);
        await remove.press("Escape");
        expect(await menu.getAttribute("open")).toBeNull();
        await detail.locator('[data-field-control="name"] input').fill("  Persisted  ");
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await saved;
        await page.reload();
        await advanced.waitFor();
        expect(await advanced.isChecked()).toBe(true);
        expect(await detail.locator('[data-field-control="name"] input').inputValue()).toBe("Persisted");
        await menu.getByRole("button", { name: "More actions" }).click();
        page.once("dialog", (dialog) => dialog.dismiss());
        await remove.click();
        expect(fixture.saved).toHaveLength(1);
        await advanced.uncheck();
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await page.waitForFunction(() => document.querySelector("cms-dashboard-w-detail p9r-action-menu") === null);
        expect(fixture.saved).toHaveLength(2);
        expect(fixture.saved[1]).toMatchObject({ advanced: false });
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20_000);
