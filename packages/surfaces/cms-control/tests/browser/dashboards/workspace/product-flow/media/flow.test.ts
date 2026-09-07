import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { imageFile } from "../../../detail-binding/media/fixture";
import { setup, upload } from "./fixture";

test("stages each file once and saves only ordered image identities with the product", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(8000);
        const { state, media, uploads } = await setup(page);
        const reads = state.reads;
        await upload(page, media, [imageFile, { ...imageFile, name: "side.svg" }]);
        await media.locator('[data-media-id="82"]').waitFor();
        expect(uploads).toHaveLength(2);
        expect(uploads.map((entry) => entry.sessionId)).toEqual([null, "upload-session"]);
        expect(await uploads[0]!.file.text()).toBe(imageFile.buffer.toString());
        expect(state.reads).toBe(reads);
        expect(state.writes).toHaveLength(0);
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([81, 82]);
        const data = await page.evaluateHandle(() => new DataTransfer());
        const tiles = media.locator("[data-media-tile]");
        await tiles.nth(1).dispatchEvent("dragstart", { dataTransfer: data });
        await tiles.nth(0).dispatchEvent("dragover", { dataTransfer: data });
        await tiles.nth(0).dispatchEvent("drop", { dataTransfer: data });
        await data.dispose();
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([82, 81]);
        const saved = page.waitForResponse("**/upsertProduct");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await saved;
        expect(state.writes[0]!.mediaIds).toEqual([82, 81]);
        expect(state.writes[0]!.uploadSessionId).toBe("upload-session");
        await media.locator('[data-media-id="82"] img').waitFor();
        await page.reload();
        await media.locator('[data-media-id="82"]').waitFor();
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([82, 81]);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25000);

test("blocks save while uploading and rolls back a failed upload without writing the product", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(8000);
        const { state, media, uploads, hold, fail } = await setup(page);
        const release = hold();
        fail();
        await upload(page, media);
        await media.locator("[data-pending]").waitFor();
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        expect(state.writes).toHaveLength(0);
        release();
        await media.locator("[data-media-tile]").waitFor({ state: "detached" });
        expect(uploads).toHaveLength(1);
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([]);
        expect(state.writes).toHaveLength(0);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("removal and replacement stay in the draft and abandonment leaves saved associations intact", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(8000);
        const { state, media, uploads } = await setup(page);
        state.current.media = [{ media: { id: 11, alt: "Original image" } }];
        await page.reload();
        await media.locator('[data-media-id="11"]').waitFor();
        const reads = state.reads;
        const chooser = page.waitForEvent("filechooser");
        await media.locator("[data-media-tile]").first().click();
        await (await chooser).setFiles(imageFile);
        await media.locator('[data-media-id="81"]').waitFor();
        expect(uploads).toHaveLength(1);
        expect(state.current.media[0].media.id).toBe(11);
        expect(state.reads).toBe(reads);
        await media.locator("[data-media-tile]").first().hover();
        await media.getByRole("button", { name: "Remove media", exact: true }).click();
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([]);
        expect(state.writes).toHaveLength(0);
        expect(state.reads).toBe(reads);
        await page.reload();
        await media.locator('[data-media-id="11"]').waitFor();
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("late staged responses cannot restore a removed pending tile", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(8000);
        const { state, media, uploads, hold } = await setup(page);
        const release = hold();
        await upload(page, media);
        await media.locator("[data-pending]").waitFor();
        await media.locator("[data-media-tile]").first().hover();
        await media.getByRole("button", { name: "Remove media", exact: true }).click();
        const done = page.waitForResponse("**/stageProductImage*");
        release();
        await done;
        expect(await media.evaluate((node) => (node as HTMLElement & { value: unknown }).value)).toEqual([]);
        expect(uploads).toHaveLength(1);
        expect(state.writes).toHaveLength(0);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
