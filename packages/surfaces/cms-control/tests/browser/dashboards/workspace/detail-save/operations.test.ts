import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountSave } from "./fixture";

test("an independent action updates technical fields while retaining the main draft", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const { state, errors } = await mountSave(page);
        const title = page.locator('p9r-input[name="title"] input');
        await title.fill("Unsaved main draft");
        await page.getByRole("button", { name: "Independent action" }).click();
        await page.waitForFunction(
            () => document.querySelector('#save input[name="expectedRevision"]')?.getAttribute("value") === "8",
        );
        expect(state.writes).toEqual([{ id: "p1", expectedRevision: "7" }]);
        expect(await title.inputValue()).toBe("Unsaved main draft");
        await page.getByRole("button", { name: "Save product" }).click();
        await page.waitForFunction(
            () => document.querySelector('#operation input[name="expectedRevision"]')?.getAttribute("value") === "9",
        );
        expect(state.writes[1]).toMatchObject({ expectedRevision: 8, title: "Unsaved main draft" });
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);

test("leaving a detail during Save ignores late effects and releases its lock", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const { state, errors } = await mountSave(page);
        state.saveDelay = 250;
        await page.getByRole("button", { name: "Save product" }).click();
        await page.waitForFunction(() => document.querySelector("#detail")?.hasAttribute("aria-busy"));
        await page.evaluate(() => {
            history.pushState({}, "", "?id=another-record");
            window.dispatchEvent(new PopStateEvent("popstate"));
        });
        await page.locator('p9r-input[name="title"] input').waitFor();
        await page.waitForTimeout(350);
        expect([state.reads, state.writes.length]).toEqual([2, 1]);
        expect(await page.locator("#detail").getAttribute("aria-busy")).toBeNull();
        await page.locator('p9r-input[name="title"] input').fill("Editable new record");
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);
