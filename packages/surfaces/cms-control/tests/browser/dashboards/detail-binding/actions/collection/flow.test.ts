import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountCollection } from "./fixture";

test("Delivery retries only one selected projection, preserves rows, and recovers the read without repeating the write", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.setDefaultTimeout(6000);
    try {
        const { writes, errors, state } = await mountCollection(page);
        const opener = page.getByRole("button", { name: "Requeue selected projection", exact: true }).first();
        await opener.click();
        const modal = page.locator("p9r-modal[open]");
        const submit = modal.getByRole("button", { name: "Requeue selected projection", exact: true });
        await submit.click();
        await page.getByText("Select exactly one available row", { exact: false }).waitFor();
        expect(writes).toHaveLength(0);
        await page.keyboard.press("Escape");
        await page.getByRole("checkbox", { name: "Select row event-1", exact: true }).check();
        await page.getByRole("checkbox", { name: "Select row event-2", exact: true }).check();
        await opener.click();
        await submit.click();
        expect(writes).toHaveLength(0);
        await page.keyboard.press("Escape");
        await page.getByRole("checkbox", { name: "Select row event-2", exact: true }).uncheck();
        const row = await page.locator('cms-dashboard-w-row[row-key="event-1"]').elementHandle();
        const before = await row!.boundingBox();
        state.failWrite = true;
        await opener.click();
        await submit.click();
        await page.getByText("Retry unavailable", { exact: false }).waitFor();
        expect(writes).toHaveLength(1);
        expect(state.reads).toBe(1);
        state.failWrite = false;
        state.failRead = true;
        await submit.click();
        await page.getByText("The operation completed, but", { exact: false }).waitFor();
        expect(writes).toHaveLength(2);
        await submit.click();
        expect(writes).toHaveLength(2);
        state.failRead = false;
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.waitForFunction(
            () => !document.querySelector("cms-dashboard-w-table")?.hasAttribute("data-operation-awaiting-read"),
        );
        expect(state.reads).toBe(3);
        expect(writes).toHaveLength(2);
        expect(writes[1]).toEqual({
            eventId: "event-1",
            action: "requeue",
            reason: "Operator requested a safe projection retry from the Delivery dashboard",
        });
        expect(await row!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await row!.boundingBox()).toEqual(before);
        expect(errors).toEqual([]);
        await page.screenshot({ path: "/tmp/cmscore-delivery-native-operation.png", fullPage: true });
    } finally {
        await browser.close();
    }
}, 30000);
