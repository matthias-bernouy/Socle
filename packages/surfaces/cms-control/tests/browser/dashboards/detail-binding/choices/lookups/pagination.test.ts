import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installLookupRoutes } from "./fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("a failed next lookup page retries the same offset and repeated clicks issue one request", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        await brand.locator("input").focus();
        fixture.fail("");
        const failed = page.waitForResponse((response) => response.status() === 503);
        await brand.getByRole("button", { name: "Load more", exact: true }).click();
        await failed;
        const release = fixture.hold("");
        const retry = page.waitForRequest((request) => request.url().includes("offset=25"));
        await brand.getByRole("button", { name: "Load more", exact: true }).evaluate((node) => {
            node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            node.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        });
        await retry;
        expect(fixture.reads).toHaveLength(3);
        release();
        await brand.getByRole("option", { name: "tennis Brand 26", exact: true }).waitFor();
        expect(fixture.reads.filter((url) => url.includes("offset=25"))).toHaveLength(2);
        expect(fixture.reads.some((url) => url.includes("offset=50"))).toBe(false);
        expect(await brand.locator("option").count()).toBe(28);
    } finally {
        await browser.close();
    }
}, 15_000);
