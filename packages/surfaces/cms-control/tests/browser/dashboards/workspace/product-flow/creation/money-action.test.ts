import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { productFixture, detailUrl } from "../fixture";

test("an independent money action initializes from the shared resource and keeps failed edits", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ locale: "fr-FR", viewport: { width: 1440, height: 1000 } });
        const state = await productFixture(page, {
            actions: [
                {
                    id: "requestPrice",
                    label: "Request price",
                    form: {
                        endpoint: "reviewOffer",
                        hiddenFields: [
                            { name: "id", type: "number", value: "$resource.id" },
                            { name: "expectedVersion", type: "number", value: "$resource.version" },
                        ],
                        fields: [
                            {
                                id: "minimum",
                                name: "minimumAmount",
                                path: "priceRule.minimumAmount",
                                label: "Minimum price",
                                type: "money",
                                currencyPath: "currency",
                                allowDecimals: { value: "$resource.wholeUnitPrices", equals: false },
                            },
                            { id: "reason", name: "reason", path: "reviewReason", label: "Reason", type: "textarea" },
                        ],
                    },
                },
            ],
        });
        Object.assign(state.current, {
            reviewReason: "Initial review",
            currency: "EUR",
            wholeUnitPrices: false,
            priceRule: { minimumAmount: 1250 },
        });
        page.setDefaultTimeout(5000);
        const writes: any[] = [];
        await page.route("**/reviewOffer", async (route) => {
            writes.push(route.request().postDataJSON());
            if (writes.length === 1) {
                await route.fulfill({ status: 422, json: { error: "Try another price" } });
            } else {
                state.current.version++;
                state.current.priceRule.minimumAmount = 1875;
                await route.fulfill({ status: 204 });
            }
        });
        await page.goto(detailUrl);
        const opener = page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Request price", exact: true });
        await opener.click();
        const modal = page.locator("p9r-modal[open]");
        const amount = modal.getByRole("textbox", { name: "Minimum price", exact: true });
        expect(await amount.inputValue()).toBe("12,50");
        expect(await modal.getByRole("textbox", { name: "Reason", exact: true }).inputValue()).toBe("Initial review");
        const amountNode = await amount.elementHandle();
        const parent = await page.locator('[data-detail-save] [name="title"] input').elementHandle();
        await amount.fill("18,75");
        await modal.getByRole("textbox", { name: "Reason", exact: true }).fill("Please confirm");
        const first = page.waitForResponse("**/reviewOffer");
        await modal.getByRole("button", { name: "Request price", exact: true }).click();
        await first;
        expect(await amount.inputValue()).toBe("18,75");
        expect(await amountNode!.evaluate((el) => el.isConnected)).toBe(true);
        await page.screenshot({ path: "/tmp/cmscore-money-action-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: "/tmp/cmscore-money-action-mobile.png" });
        const second = page.waitForResponse("**/reviewOffer");
        await modal.getByRole("button", { name: "Request price", exact: true }).click();
        await second;
        await page.waitForFunction(() => !document.querySelector("p9r-modal[open]"));
        expect(writes).toEqual([
            { id: 42, expectedVersion: 7, minimumAmount: 1875, reason: "Please confirm" },
            { id: 42, expectedVersion: 7, minimumAmount: 1875, reason: "Please confirm" },
        ]);
        expect(await parent!.evaluate((el) => el.isConnected)).toBe(true);
        await opener.click();
        expect(await amount.inputValue()).toBe("18,75");
        await page.keyboard.press("Escape");
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
