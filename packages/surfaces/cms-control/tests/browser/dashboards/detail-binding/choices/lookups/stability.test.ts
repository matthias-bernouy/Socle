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

test("remote lookup delays, stale responses, dependency changes and retries preserve the active draft", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(5000);
        const fixture = await installLookupRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const brand = page.locator('p9r-combobox[data-field-control="brand"]');
        const input = brand.locator("input");
        await brand.locator('option[value="brand-0"]').waitFor({ state: "attached" });
        const name = page.locator('[data-field-control="name"] input');
        await name.fill("Keep this draft");
        const release = fixture.hold("Slow");
        const pending = page.waitForRequest((request) => request.url().includes("q=Slow"));
        await input.fill("Slow");
        await pending;
        await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 3));
        const nav = page.locator("cms-dashboards-nav");
        const navBox = await nav.boundingBox();
        const box = await brand.boundingBox();
        for (let i = 0; i < 5; i += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await brand.boundingBox()).toEqual(box);
            expect(await nav.boundingBox()).toEqual(navBox);
            expect(await input.inputValue()).toBe("Slow");
        }
        release();
        await brand.getByRole("option", { name: "Slow Brand 0", exact: true }).waitFor();
        expect(
            await input.evaluate((node: HTMLInputElement) => [
                (node.getRootNode() as ShadowRoot).activeElement === node,
                node.selectionStart,
                node.selectionEnd,
            ]),
        ).toEqual([true, 1, 3]);
        const releaseOld = fixture.hold("Old");
        const old = page.waitForRequest((request) => request.url().includes("q=Old"));
        await input.fill("Old");
        await old;
        await input.fill("Latest");
        await brand.getByRole("option", { name: "Latest Brand 0", exact: true }).waitFor();
        releaseOld();
        await page.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        expect(await input.inputValue()).toBe("Latest");
        expect(await brand.locator("option").first().textContent()).toBe("Latest Brand 0");
        fixture.fail("Broken");
        const failed = page.waitForResponse((response) => response.status() === 503);
        await input.fill("Broken");
        await failed;
        expect(await input.inputValue()).toBe("Broken");
        await input.fill("");
        await input.fill("Broken");
        await brand.getByRole("option", { name: "Broken Brand 0", exact: true }).waitFor();
        const dependent = page.waitForResponse((response) => response.url().includes("category=padel"));
        const category = page.locator('[data-field-control="category"]');
        await category.getByRole("combobox").click();
        await category.getByRole("option", { name: "Padel", exact: true }).click();
        await dependent;
        await page.waitForFunction(
            () => document.querySelector("p9r-combobox option")?.textContent === "padel Brand 0",
        );
        expect(await name.inputValue()).toBe("Keep this draft");
        expect(fixture.reads.filter((url) => url.includes("q=Broken"))).toHaveLength(2);
        expect(fixture.reads.filter((url) => url.includes("category=padel"))).toHaveLength(1);
        expect(fixture.reads).toHaveLength(7);
    } finally {
        await browser.close();
    }
}, 20_000);
