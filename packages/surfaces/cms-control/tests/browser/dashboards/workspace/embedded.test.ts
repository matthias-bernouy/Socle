import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installReadonlyRoutes } from "../detail-binding/fixture";

const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("embedded settings bind their own definitions and never fall back to an unrelated dashboard", async () => {
    const browser = await chromium.launch();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
        release = resolve;
    });
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        await installReadonlyRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        await page.locator("cms-dashboard-w-detail").waitFor();
        const url = page.url();
        await page.route("**/api/dashboards", async (route) => {
            await hold;
            await route.fallback();
        });
        await page.evaluate(() => {
            const view = document.createElement("cms-dashboards-admin");
            view.setAttribute("embedded", "");
            view.setAttribute("dashboard-id", "summary");
            document.querySelector("cms-dashboards-admin")!.replaceWith(view);
        });
        await page.getByText("Loading…", { exact: true }).waitFor();
        release();
        await page.locator("cms-dashboard-w-detail").waitFor();
        expect(page.url()).toBe(url);
        expect(await page.locator("cms-dashboards-admin [data-dashboard-list-source][cms-source]").count()).toBe(1);
        await page.evaluate(() => {
            const view = document.createElement("cms-dashboards-admin");
            view.setAttribute("embedded", "");
            view.setAttribute("dashboard-id", "missing");
            document.querySelector("cms-dashboards-admin")!.replaceWith(view);
        });
        const unavailable = page.locator('p9r-alert[cms-condition="definitionsUnavailable"]');
        await unavailable.waitFor();
        expect(await unavailable.textContent()).toBe("The settings dashboard is unavailable.");
        expect(await page.locator("cms-dashboard-w-detail").count()).toBe(0);
        expect(page.url()).toBe(url);
    } finally {
        release();
        await browser.close();
    }
}, 15_000);
