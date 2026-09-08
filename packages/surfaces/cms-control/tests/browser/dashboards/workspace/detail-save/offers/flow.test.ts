import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { offerFixture } from "./fixture";

for (const startNew of [false, true]) {
    test(`offer ${startNew ? "creation" : "edition"} stages media and saves one form without replacing its controls`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(7000);
            const { state, url } = await offerFixture(page, startNew);
            await page.goto(url);
            const title = page.locator('[name="title"] input');
            await title.fill("Edited offer");
            const titleNode = await title.elementHandle();
            const section = await page.locator("cms-detail-section").first().elementHandle();
            const media = page.locator('cms-dashboard-media-field[data-field-control="media"]');
            const chooser = page.waitForEvent("filechooser");
            await media.getByRole("button", { name: "Add media", exact: true }).click();
            await (await chooser).setFiles({ name: "test.png", mimeType: "image/png", buffer: Buffer.from("test") });
            await media.locator('[data-media-id="101"]:not([data-pending])').waitFor();
            expect(state.writes).toEqual([]);
            expect(state.resource.media).toEqual([]);
            expect(await titleNode!.evaluate((n) => n.isConnected)).toBe(true);
            expect(await title.inputValue()).toBe("Edited offer");
            await page.screenshot({ path: `/tmp/cmscore-offer-${startNew}-staged.png`, fullPage: true });
            state.fail = true;
            const failed = page.waitForResponse("**/upsertOffer");
            await page.getByRole("button", { name: "Save offer", exact: true }).click();
            expect((await failed).status()).toBe(409);
            expect(await title.inputValue()).toBe("Edited offer");
            expect(await media.locator('[data-media-id="101"]').count()).toBe(1);
            expect(state.writes[0]).toMatchObject({
                title: "Edited offer",
                sellerId: 2,
                productId: 1,
                mediaIds: [101],
                uploadSessionId: "11111111-1111-4111-8111-111111111111",
            });
            expect(state.writes[0]!.reviewReason).toBeUndefined();
            expect(state.writes[0]!.minimumAmount).toBeUndefined();
            if (startNew) {
                expect(state.writes[0]!.id).toBeUndefined();
            } else {
                expect(state.writes[0]).toMatchObject({ id: 42, expectedVersion: 7 });
            }
            let release!: () => void;
            state.pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            const success = page.waitForResponse("**/upsertOffer");
            await page.getByRole("button", { name: "Save offer", exact: true }).click();
            await page.waitForTimeout(250);
            expect(await titleNode!.evaluate((n) => n.isConnected)).toBe(true);
            expect(await section!.evaluate((n) => n.isConnected)).toBe(true);
            release();
            expect((await success).status()).toBe(200);
            await page.waitForFunction(
                (expected) =>
                    document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === expected,
                startNew ? "1" : "8",
            );
            if (!startNew) {
                expect(await titleNode!.evaluate((n) => n.isConnected)).toBe(true);
            }
            expect(await title.inputValue()).toBe("Edited offer");
            expect(state.reads).toBe(2);
            expect(state.uploads).toBe(1);
            expect(state.writes).toHaveLength(2);
            expect(await page.locator("form form").count()).toBe(0);
            if (startNew) {
                expect(new URL(page.url()).searchParams.get("row")).toBe("42");
            }
            await page.setViewportSize({ width: 390, height: 844 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: `/tmp/cmscore-offer-${startNew}-mobile.png`, fullPage: true });
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 25000);
}

test("leaving an unsaved offer never sends its media selection to Save", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const { state, url } = await offerFixture(page, true);
        await page.goto(url);
        await page.locator('[name="title"] input').fill("Abandoned draft");
        await page.reload();
        await page.locator('[name="title"] input').waitFor();
        expect(await page.locator('[name="title"] input').inputValue()).toBe("");
        expect(state.writes).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);
