import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { reviewFixture } from "./fixture";

for (const [kind, label, intent] of [
    ["offer", "Request seller price", "request_price"],
    ["offer", "Approve offer", "approve"],
    ["offer", "Reject offer", "reject"],
    ["seller", "Verify seller", "verified"],
    ["seller", "Suspend seller", "suspended"],
] as const) {
    test(`${label} opens an independent form, preserves failures, and refreshes the shared revision`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({
                locale: "fr-FR",
                viewport: { width: 1440, height: 1000 },
                reducedMotion: "reduce",
            });
            page.setDefaultTimeout(6000);
            const { state, url, read, write } = await reviewFixture(page, kind);
            await page.goto(url);
            const host = page.locator(`cms-dashboard-w-detail[data-widget-id="${kind}Detail"]`);
            const opener = host.locator('[slot="bound-actions"]').getByRole("button", { name: label, exact: true });
            await opener.click();
            const modal = host.locator("p9r-modal[open]");
            const note = modal.getByRole("textbox", {
                name: kind === "offer" ? "Review note" : "Review reason",
                exact: true,
            });
            expect(await note.inputValue()).toBe("Previous review");
            await note.fill("Cancelled review");
            await page.keyboard.press("Escape");
            expect(state.writes).toHaveLength(0);
            await opener.click();
            expect(await note.inputValue()).toBe("Previous review");
            const node = await host.elementHandle();
            const section = await host.locator("cms-detail-section").first().elementHandle();
            const noteNode = await note.elementHandle();
            await note.fill("Checked by the administrator");
            if (intent === "request_price") {
                expect(await modal.getByRole("textbox", { name: /^Minimum price/ }).inputValue()).toBe("12,50");
                await modal.getByRole("textbox", { name: /^Minimum price/ }).fill("");
                await modal.getByRole("button", { name: label, exact: true }).click();
                expect(state.writes).toHaveLength(0);
                await modal.getByRole("textbox", { name: /^Minimum price/ }).fill("15,25");
                await modal.getByRole("textbox", { name: /^Maximum price/ }).fill("20,75");
            }
            const form = modal.locator("form");
            expect(await form.locator('input[type="hidden"][name="expectedVersion"]').inputValue()).toBe("7");
            expect(await page.locator("form form").count()).toBe(0);
            state.fail = true;
            const failed = page.waitForResponse(`**/${write}`);
            await modal.getByRole("button", { name: label, exact: true }).click();
            await failed;
            expect(await note.inputValue()).toBe("Checked by the administrator");
            expect(await noteNode!.evaluate((element) => element.isConnected)).toBe(true);
            let release!: () => void;
            state.pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            const requested = page.waitForRequest(`**/${write}`);
            await modal.getByRole("button", { name: label, exact: true }).click();
            await requested;
            expect(state.reads).toBe(1);
            const refreshed = page.waitForResponse(`**/${read}?*`);
            release();
            await refreshed;
            await page.waitForFunction(() => !document.querySelector("p9r-modal[open]"));
            expect(await node!.evaluate((element) => element.isConnected)).toBe(true);
            expect(await section!.evaluate((element) => element.isConnected)).toBe(true);
            expect(state.reads).toBe(2);
            const expected = {
                id: 42,
                expectedVersion: 7,
                [kind === "offer" ? "action" : "status"]: intent,
                reason: "Checked by the administrator",
                ...(intent === "request_price" ? { minimumAmount: 1525, maximumAmount: 2075 } : {}),
            };
            expect(state.writes).toEqual([expected, expected]);
            await opener.click();
            expect(await form.locator('[name="expectedVersion"]').inputValue()).toBe("8");
            await page.screenshot({ path: `/tmp/cmscore-review-${intent}-desktop.png` });
            await page.setViewportSize({ width: 390, height: 844 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: `/tmp/cmscore-review-${intent}-mobile.png` });
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 20000);
}
