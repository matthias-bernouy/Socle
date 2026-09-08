import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installNestedRoutes } from "../nested-fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("a list inside a detail submits its own form without validating or saving the parent", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installNestedRoutes(page, bundle, styles, true);
        await page.goto("http://cms.test/admin/sources?source=forms&dashboard=forms");
        const parent = page.locator('cms-dashboard-w-detail[data-widget-id="parent"]');
        const input = parent.locator('[data-field-control="name"] input');
        await input.fill("");
        const node = await input.elementHandle();
        const list = parent.locator("cms-dashboard-w-navigation-list");
        const rows = list.locator("cms-dashboard-w-navigation-item");
        const mainForm = await parent.locator("[data-detail-save]").getAttribute("id");
        expect(await list.getAttribute("form")).not.toBe(mainForm);
        expect(await page.evaluate(() => document.querySelectorAll("form form").length)).toBe(0);
        const read = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/children"));
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        await read;
        expect(fixture.writes).toEqual([
            { endpoint: "reorder", body: { ids: ["question-2", "question-3", "question-1"] } },
        ]);
        expect(await input.inputValue()).toBe("");
        expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
        expect(fixture.reads.filter((path) => path.endsWith("/parent"))).toHaveLength(1);
    } finally {
        await browser.close();
    }
}, 15000);
