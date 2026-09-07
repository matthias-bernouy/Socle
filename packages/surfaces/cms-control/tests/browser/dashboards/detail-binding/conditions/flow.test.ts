import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installConditionalRoutes } from "./fixture";
import { checkPendingSaveAndReadFailure } from "./stability";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("conditional fields use local edits, retain hidden drafts and accept normalized saves", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, reducedMotion: "reduce" });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installConditionalRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=summary");
        const detail = page.locator("cms-dashboard-w-detail");
        const mode = detail.locator('[data-field-control="mode"]');
        const note = detail.locator('[data-field-control="note"] input');
        const name = detail.locator('[data-field-control="name"] input');
        const price = detail.locator('[data-field-control="price"] input');
        const save = page.getByRole("button", { name: "Save choices", exact: true });
        await mode.waitFor();
        expect(await detail.getAttribute("data-declarative")).not.toBeNull();
        expect(await note.count()).toBe(0);
        expect(await price.inputValue()).toBe("15");
        await mode.getByRole("combobox").click();
        await mode.getByRole("option", { name: "Advanced", exact: true }).click();
        await note.waitFor();
        await save.click();
        expect(fixture.saved).toHaveLength(0);
        await note.fill("Keep this draft");
        await mode.getByRole("combobox").click();
        await mode.getByRole("option", { name: "Basic", exact: true }).click();
        expect(await note.count()).toBe(0);
        await mode.getByRole("combobox").click();
        await mode.getByRole("option", { name: "Advanced", exact: true }).click();
        await note.waitFor();
        expect(await note.inputValue()).toBe("Keep this draft");
        await detail.getByRole("checkbox", { name: "Decimals", exact: true }).check();
        expect(await price.inputValue()).toBe("15.00");
        expect(fixture.requests.filter((path) => path.endsWith("/item"))).toHaveLength(1);
        await name.fill("  Normalized name  ");
        await price.fill("16.75");
        const response = page.waitForResponse((result) => result.url().endsWith("/save"));
        await save.click();
        await response;
        await page.evaluate(
            () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
        );
        await page.waitForFunction(() => {
            const host = document.querySelector('[data-field-control="name"]');
            return host?.shadowRoot?.querySelector("input")?.value === "Normalized name";
        });
        expect(fixture.saved[0]).toEqual({
            name: "  Normalized name  ",
            mode: "advanced",
            note: "Keep this draft",
            decimals: true,
            price: 1675,
        });
        expect(await note.inputValue()).toBe("Keep this draft");
        await page.reload();
        await note.waitFor();
        expect(await name.inputValue()).toBe("Normalized name");
        expect(await note.inputValue()).toBe("Keep this draft");
        expect(await price.inputValue()).toBe("16.75");
        await checkPendingSaveAndReadFailure(page, fixture);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20_000);
