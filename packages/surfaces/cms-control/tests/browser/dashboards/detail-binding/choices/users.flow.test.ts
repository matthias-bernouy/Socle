import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { aliceLabel, installUserRoutes, subject } from "./users.fixture";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("CMS user fields share one lazy directory read and persist opaque subjects through saved reloads", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(5000);
        const fixture = await installUserRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const show = page.getByRole("checkbox", { name: "Choose CMS users", exact: true });
        await show.waitFor();
        expect(fixture.reads()).toBe(0);
        expect(await page.locator("p9r-combobox").count()).toBe(0);
        await show.check();
        const user = page.locator('[data-field-control="user"]');
        const reviewer = page.locator('[data-field-control="reviewer"]');
        await user.locator("option").filter({ hasText: aliceLabel }).waitFor({ state: "attached" });
        expect(fixture.reads()).toBe(1);
        expect(await reviewer.locator("input").inputValue()).toBe("Unknown CMS user · missing:subject");
        const save = page.getByRole("button", { name: "Save choices", exact: true });
        await save.click();
        expect(fixture.saved).toHaveLength(0);
        expect(
            await page.locator("[data-detail-save]").evaluate((form) => (form as HTMLFormElement).checkValidity()),
        ).toBe(false);
        await page.locator('[data-field-control="name"] input').fill("  Changed  ");
        expect(
            await page.locator("[data-detail-save]").evaluate((form) => (form as HTMLFormElement).checkValidity()),
        ).toBe(false);
        expect(await user.locator("input").getAttribute("aria-invalid")).toBe("true");
        await user.locator("input").fill("Alice");
        await user.getByRole("option", { name: aliceLabel, exact: true }).click();
        expect(await user.getAttribute("invalid")).toBeNull();
        await show.uncheck();
        expect(await page.locator("p9r-combobox").count()).toBe(0);
        await show.check();
        await user.locator("input").waitFor();
        expect(fixture.reads()).toBe(1);
        expect(await user.locator("input").inputValue()).toBe(aliceLabel);
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await save.click();
        await saved;
        expect(fixture.saved).toEqual([
            { name: "  Changed  ", shown: true, user: subject, reviewer: "missing:subject" },
        ]);
        await page.reload();
        await user.locator("option").filter({ hasText: aliceLabel }).waitFor({ state: "attached" });
        expect(await user.locator("input").inputValue()).toBe(aliceLabel);
        expect(await page.locator('[data-field-control="name"] input').inputValue()).toBe("Changed");
        expect(fixture.reads()).toBe(2);
        expect(await user.evaluate((node) => node.getRootNode() === document)).toBe(true);
    } finally {
        await browser.close();
    }
}, 20_000);
