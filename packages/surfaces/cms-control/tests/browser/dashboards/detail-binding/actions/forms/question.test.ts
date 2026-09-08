import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountEditor } from "./fixture";

test("question Save submits native choices and false booleans, preserves the form and rereads its stable reference", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        page.setDefaultTimeout(5000);
        const state = await mountEditor(page, "questionDetail", "question-ref");
        const key = page.locator('[data-field-control="key"] input');
        await key.fill("renamedQuestion");
        await page.locator('[data-field-control="required"]').uncheck();
        await page.locator('[data-field-control="multiple"]').uncheck();
        const options = page.locator('[data-field-control="options"]');
        const rows = options.locator(".row[data-index]");
        await rows.first().locator('[data-item-field="label"] input').fill("Edited first");
        await rows.first().locator(".handle").dragTo(rows.last().locator(".handle"));
        const node = await key.elementHandle();
        const box = await key.boundingBox();
        const read = page.waitForResponse("**/manageQuestion?ref=question-ref");
        await page.getByRole("button", { name: "Save question", exact: true }).click();
        await read;
        expect(state.writes[0]!.body).toMatchObject({
            ref: "question-ref",
            key: "renamedQuestion",
            required: false,
            multiple: false,
            options: [
                { key: "second", label: "Second", position: 0 },
                { key: "first", label: "Edited first", position: 1 },
            ],
        });
        expect(state.writes[0]!.body).not.toHaveProperty("imageOptions");
        expect(await node!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await key.boundingBox()).toEqual(box);
        const type = page.locator('[data-field-control="type"]');
        await type.getByRole("combobox").click();
        await type.getByRole("option", { name: "Short text", exact: true }).click();
        const next = page.waitForResponse("**/manageQuestion?ref=question-ref");
        await page.getByRole("button", { name: "Save question", exact: true }).click();
        await next;
        expect(state.writes[1]!.body).toMatchObject({ type: "text", required: false });
        expect(state.writes[1]!.body).not.toHaveProperty("options");
        expect(state.writes[1]!.body).not.toHaveProperty("imageOptions");
        await page.screenshot({ path: "/tmp/cmscore-forms-question-save.png" });
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
