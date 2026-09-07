import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { setup, upload } from "./fixture";

test("a new product stages images before its first Save and a failed identity read retries without creating again", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(6000);
        const { state, media, uploads } = await setup(page, true);
        await page.locator('[name="title"] input').fill("New product with images");
        await upload(page, media);
        await media.locator('[data-media-id="81"]:not([data-pending])').waitFor();
        expect(uploads[0]!.sessionId).toBeNull();
        expect(state.creates).toHaveLength(0);
        state.readStatus = 503;
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForURL((url) => url.searchParams.get("row") === "43");
        await page.getByRole("button", { name: "Retry", exact: true }).waitFor();
        expect(state.creates).toHaveLength(1);
        expect(state.creates[0]).toMatchObject({ mediaIds: [81], uploadSessionId: "upload-session" });
        expect(state.creates[0]).not.toHaveProperty("id");
        state.readStatus = 200;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await media.locator('[data-media-id="81"]').waitFor();
        expect(state.creates).toHaveLength(1);
        expect(state.writes).toHaveLength(0);
        expect(await page.locator('[name="title"] input').inputValue()).toBe("New product with images");
        expect(state.errors).toEqual([]);
        await page.screenshot({ path: "/tmp/cmscore-create-navigation-media-recovered.png", fullPage: true });
    } finally {
        await browser.close();
    }
}, 20000);
