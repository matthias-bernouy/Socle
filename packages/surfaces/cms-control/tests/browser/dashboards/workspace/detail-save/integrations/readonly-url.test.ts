import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { cases } from "./definitions";
import { integrationFixture } from "./fixture";

test("readonly URLs use binding, wrap on mobile and reject executable schemes", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        const entry = cases.find((item) => item.widget.id === "shipmentDetail")!;
        const { state, url } = await integrationFixture(page, entry);
        const warnings: string[] = [];
        page.on("console", (message) => {
            if (message.type() === "warning") {
                warnings.push(message.text());
            }
        });
        state.resource.trackingUrl = `https://tracking.example.test/${"reference".repeat(15)}`;
        await page.goto(url);
        const field = page.locator('cms-dashboard-detail-field[label="Tracking URL"]');
        const link = field.getByRole("link");
        await link.waitFor({ state: "visible" });
        expect(await link.getAttribute("href")).toBe(state.resource.trackingUrl);
        const box = await field.boundingBox();
        expect(box!.x + box!.width).toBeLessThanOrEqual(391);
        state.resource.trackingUrl = "javascript:alert(1)";
        await page.reload();
        await field.getByText("javascript:alert(1)", { exact: true }).waitFor({ state: "visible" });
        expect(await field.getByRole("link").count()).toBe(0);
        expect(state.errors).toEqual([]);
        expect(warnings.filter((message) => message.includes("cms-condition"))).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);
