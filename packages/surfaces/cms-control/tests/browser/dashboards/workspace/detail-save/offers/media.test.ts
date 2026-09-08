import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { offerFixture } from "./fixture";

const file = { name: "image.png", mimeType: "image/png", buffer: Buffer.from("image") };

test("offer image ordering is saved, while replacement and removal remain cancellable drafts", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(7000);
        const { state, url } = await offerFixture(page);
        state.resource.media = [{ media: { id: 11, alt: "Original" } }];
        await page.goto(url);
        const media = page.locator('cms-dashboard-media-field[data-field-control="media"]');
        await media.locator('[data-media-id="11"]').waitFor();
        const chooser = page.waitForEvent("filechooser");
        await media.getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles(file);
        await media.locator('[data-media-id="101"]:not([data-pending])').waitFor();
        const transfer = await page.evaluateHandle(() => new DataTransfer());
        await media.locator('[data-media-id="101"]').dispatchEvent("dragstart", { dataTransfer: transfer });
        await media.locator('[data-media-id="11"]').dispatchEvent("dragover", { dataTransfer: transfer });
        await media.locator('[data-media-id="11"]').dispatchEvent("drop", { dataTransfer: transfer });
        await transfer.dispose();
        expect(state.writes).toEqual([]);
        expect(state.resource.media[0].media.id).toBe(11);
        await page.getByRole("button", { name: "Save offer", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(state.writes[0]!.mediaIds).toEqual([101, 11]);
        const replace = page.waitForEvent("filechooser");
        await media.locator('[data-media-id="11"]').click();
        await (await replace).setFiles(file);
        await media.locator('[data-media-id="102"]:not([data-pending])').waitFor();
        await media.locator('[data-media-id="102"]').hover();
        await media.locator('[data-media-id="102"]').getByRole("button", { name: "Remove media", exact: true }).click();
        expect(state.writes).toHaveLength(1);
        expect(state.resource.media.map((item: any) => item.media.id)).toEqual([101, 11]);
        await page.reload();
        await media.locator('[data-media-id="11"]').waitFor();
        expect(await media.locator('[data-media-id="102"]').count()).toBe(0);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("an offer saved before a failed refresh retries only its read", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(7000);
        const { state, url } = await offerFixture(page);
        await page.goto(url);
        const title = page.locator('[name="title"] input');
        await title.fill("Saved before read failure");
        const node = await title.elementHandle();
        state.failRead = true;
        await page.getByRole("button", { name: "Save offer", exact: true }).click();
        const retry = page.getByRole("button", { name: /Retry/ });
        await retry.waitFor();
        expect(state.writes).toHaveLength(1);
        expect(await title.inputValue()).toBe("Saved before read failure");
        expect(await node!.evaluate((n) => n.isConnected)).toBe(true);
        await retry.click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(state.writes).toHaveLength(1);
        expect(state.reads).toBe(3);
        expect(await node!.evaluate((n) => n.isConnected)).toBe(true);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);
