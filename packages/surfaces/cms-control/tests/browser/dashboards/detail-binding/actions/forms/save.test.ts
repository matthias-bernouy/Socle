import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountEditor } from "./fixture";

test("Forms creates through its detail then saves metadata without replacing controls or sending the definition", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const state = await mountEditor(page);
        await page.getByRole("button", { name: "Create form", exact: true }).click();
        const host = page.locator('cms-dashboard-w-detail[data-widget-id="formDetail"]');
        const title = host.locator('[data-field-control="title"] input');
        await title.fill("New contact");
        await host.locator('[data-field-control="newKey"] input').fill("new-contact");
        expect(state.reads).not.toContain("manageSections");
        expect(await host.locator("cms-dashboard-w-navigation-list").isVisible()).toBe(false);
        const save = host.getByRole("button", { name: "Save form", exact: true });
        const created = page.waitForResponse((r) => r.url().includes("/manageForm?key=new-contact"));
        await save.click();
        await created;
        await page.waitForFunction(() => new URL(location.href).searchParams.get("row") === "new-contact");
        expect(state.writes[0]!.body).toEqual({
            title: "New contact",
            key: "new-contact",
            description: "",
            accessMode: "public",
        });
        await host.locator("cms-dashboard-w-navigation-list").waitFor();
        expect(await host.locator('[data-field-control="newKey"]').isVisible()).toBe(false);
        const node = await title.elementHandle();
        const before = await title.boundingBox();
        await title.fill("  Updated title  ");
        state.delay = 300;
        const pending = page.waitForRequest("**/saveFormDraft");
        const read = page.waitForResponse("**/manageForm?key=new-contact");
        await save.click();
        await pending;
        expect(
            await title.evaluate((e) =>
                e.dispatchEvent(
                    new InputEvent("beforeinput", {
                        bubbles: true,
                        composed: true,
                        cancelable: true,
                        data: "blocked",
                        inputType: "insertText",
                    }),
                ),
            ),
        ).toBe(false);
        await read;
        await page.waitForFunction(
            () => !(document.querySelector('[data-field-control="title"] input') as HTMLInputElement)?.disabled,
        );
        expect(state.writes[1]!.body).toEqual({
            id: 2,
            title: "  Updated title  ",
            description: "",
            accessMode: "public",
        });
        expect(await title.inputValue()).toBe("Updated title");
        expect(await node!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await title.boundingBox()).toEqual(before);
        expect(await page.locator("form form").count()).toBe(0);
        await page.screenshot({ animations: "disabled", path: "/tmp/cmscore-forms-native-save-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("w13c-left-menu-layout .app-sidebar").waitFor({ state: "hidden" });
        const bounds = await title.boundingBox();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        await page.screenshot({ animations: "disabled", path: "/tmp/cmscore-forms-native-save-mobile.png" });
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("Forms keeps rejected edits and retries a failed reread without resaving", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const state = await mountEditor(page, "formDetail", "contact");
        const title = page.locator('[data-field-control="title"] input');
        await title.fill("Edited");
        const node = await title.elementHandle();
        state.failSave = true;
        const rejected = page.waitForResponse("**/saveFormDraft");
        await page.getByRole("button", { name: "Save form", exact: true }).click();
        await rejected;
        expect(await title.inputValue()).toBe("Edited");
        expect(state.reads.filter((x) => x === "manageForm")).toHaveLength(1);
        state.failRead = true;
        const failedRead = page.waitForResponse("**/manageForm?key=contact");
        await page.getByRole("button", { name: "Save form", exact: true }).click();
        await failedRead;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('[data-detail-save][aria-busy="true"]'));
        expect(state.writes).toHaveLength(2);
        expect(await node!.evaluate((e) => e.isConnected)).toBe(true);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
