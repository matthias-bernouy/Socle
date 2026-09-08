import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { resolve } from "node:path";
import { installNavigationRoutes } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();
const order = (rows: Locator) => rows.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("row-key")));

test("reordering keeps the list stable, blocks concurrent drops, and restores a rejected order", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
        page.setDefaultTimeout(5000);
        const fixture = await installNavigationRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=fields&dashboard=fields");
        const list = page.locator("cms-dashboard-w-navigation-list");
        const rows = list.locator("cms-dashboard-w-navigation-item");
        await rows.last().waitFor();
        const node = await list.elementHandle();
        const box = await list.boundingBox();
        fixture.failWrite();
        fixture.hold();
        const request = page.waitForRequest("**/reorder");
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        await request;
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
        expect(await list.evaluate((node: any) => node.value)).toEqual(["club", "region", "agency"]);
        expect(await list.boundingBox()).toEqual(box);
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        expect(fixture.orders).toHaveLength(1);
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
        const rejected = page.waitForResponse("**/reorder");
        fixture.release();
        await rejected;
        await page.waitForFunction(() => !document.querySelector('cms-dashboard-w-navigation-list[aria-busy="true"]'));
        expect(await order(rows)).toEqual(["agency", "club", "region"]);
        expect(await list.boundingBox()).toEqual(box);
        expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
        const read = page.waitForResponse("**/list");
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        await read;
        await page.waitForFunction(() => !document.querySelector('cms-dashboard-w-navigation-list[aria-busy="true"]'));
        expect(fixture.orders).toHaveLength(2);
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
        expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
        await page.screenshot({ path: "/tmp/cmscore-order-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: "/tmp/cmscore-order-mobile.png" });
    } finally {
        await browser.close();
    }
}, 20000);

test("a saved order with a failed read is recovered without repeating the mutation", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installNavigationRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=fields&dashboard=fields");
        const list = page.locator("cms-dashboard-w-navigation-list");
        const rows = list.locator("cms-dashboard-w-navigation-item");
        await rows.last().waitFor();
        fixture.failRead();
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        const retry = list.getByRole("button", { name: "Retry", exact: true });
        await retry.waitFor();
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        expect(fixture.orders).toHaveLength(1);
        await retry.click();
        await page.waitForFunction(() => !document.querySelector('cms-dashboard-w-navigation-list[aria-busy="true"]'));
        expect(fixture.orders).toHaveLength(1);
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
        await page.reload();
        await rows.last().waitFor();
        expect(await order(rows)).toEqual(["club", "region", "agency"]);
    } finally {
        await browser.close();
    }
}, 15000);
