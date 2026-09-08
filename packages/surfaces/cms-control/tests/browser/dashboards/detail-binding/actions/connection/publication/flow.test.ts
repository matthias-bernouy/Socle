import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountPublication } from "./fixture";

test("Consent creates inactive defaults and subsequently publishes through the same native save", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.setDefaultTimeout(6000);
    try {
        const { writes, state, errors } = await mountPublication(page, "consent", true);
        await page.locator('[data-field-control="newContextKey"] input').fill("new_policy");
        page.once("dialog", (d) => d.accept());
        await page.getByRole("button", { name: "Publish configuration", exact: true }).click();
        await page.waitForFunction(() => new URL(location.href).searchParams.get("row") === "new_policy");
        await page.locator('input[name="expectedRevision"][value="v1"]').waitFor({ state: "attached" });
        expect(writes[0]!.body).toEqual({
            expectedRevision: "new",
            values: { contextKey: "new_policy", enabled: false },
        });
        expect(await page.locator('[data-field-control="newContextKey"]').count()).toBe(0);
        page.once("dialog", (d) => d.accept());
        await page.getByRole("button", { name: "Publish configuration", exact: true }).click();
        await page.locator('input[name="expectedRevision"][value="v2"]').waitFor({ state: "attached" });
        expect(writes[1]!.body).toEqual({
            contextKey: "new_policy",
            expectedRevision: "v1",
            values: { enabled: false },
        });
        expect(state.reads).toBe(3);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25000);

test.each(["consent", "stripe-connect"] as const)(
    "%s publication keeps typed fields, confirms, handles conflicts and rereads only once",
    async (kind) => {
        const browser = await chromium.launch();
        const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
        page.setDefaultTimeout(6000);
        try {
            const { writes, state, errors } = await mountPublication(page, kind);
            const revisionName = kind === "consent" ? "expectedRevision" : "input[expectedVersion]";
            const field = page.locator(
                kind === "consent" ? '[data-item-field="label"] input' : '[data-field-control="label"] input',
            );
            await field.fill("Updated terms");
            const handle = await field.elementHandle();
            const button = page.getByRole("button", {
                name: kind === "consent" ? "Publish configuration" : "Publish seller terms",
                exact: true,
            });
            page.once("dialog", (d) => d.dismiss());
            await button.click();
            expect(writes).toHaveLength(0);
            state.failure = true;
            page.once("dialog", (d) => d.accept());
            await button.click();
            await page.getByText("Revision conflict", { exact: false }).waitFor();
            expect(state.reads).toBe(1);
            expect(await field.inputValue()).toBe("Updated terms");
            state.failure = false;
            state.delay = 180;
            const before = await handle!.boundingBox();
            page.once("dialog", (d) => d.accept());
            await button.click();
            await page.locator(`input[name="${revisionName}"][value="v2"]`).waitFor({ state: "attached" });
            expect(state.reads).toBe(2);
            expect(writes).toHaveLength(2);
            const body = writes[1]!.body;
            if (kind === "consent") {
                expect(body).toMatchObject({
                    contextKey: "buyer_checkout",
                    expectedRevision: "v1",
                    values: { enabled: true, documents: [{ label: "Updated terms", page: "/terms", enabled: true }] },
                });
            } else {
                expect(body).toEqual({
                    actionId: "publish-seller-terms",
                    input: {
                        expectedVersion: "v1",
                        documentKey: "seller_terms",
                        label: "Updated terms",
                        consentText: "I accept the seller terms",
                        page: "/terms",
                    },
                });
            }
            expect(await handle!.evaluate((node) => node.isConnected)).toBe(true);
            expect(await handle!.boundingBox()).toEqual(before);
            expect(errors).toEqual([]);
            await page.screenshot({ path: `/tmp/cmscore-${kind}-native-publication.png`, fullPage: true });
        } finally {
            await browser.close();
        }
    },
    25000,
);
