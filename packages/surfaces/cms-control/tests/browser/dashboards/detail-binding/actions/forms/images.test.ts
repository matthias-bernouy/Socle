import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountEditor } from "./fixture";

const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
);

test("Forms image choices upload and replace assets independently but persist their choices only on Save", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
        page.setDefaultTimeout(5000);
        const state = await mountEditor(page, "questionDetail", "question-ref");
        state.question.presentation = "image-grid";
        state.question.options = [
            { key: "first", label: "First", image: { mediaId: "100", alt: "First image" }, position: 0 },
            { key: "second", label: "Second", image: null, position: 1 },
        ];
        const uploads: Array<{ ref: string | null; names: string[] }> = [];
        let failUpload = false;
        await page.route("**/choiceImage?*", (route) => route.fulfill({ contentType: "image/png", body: png }));
        await page.route("**/uploadChoiceImage?*", async (route) => {
            const req = route.request();
            const form = await new Response(new Uint8Array(req.postDataBuffer()!).buffer, {
                headers: { "content-type": req.headers()["content-type"]! },
            }).formData();
            const files: File[] = [];
            for (const value of form.values()) {
                if (typeof value !== "string") {
                    files.push(value);
                }
            }
            uploads.push({ ref: new URL(req.url()).searchParams.get("ref"), names: files.map((file) => file.name) });
            await route.fulfill(
                failUpload
                    ? { status: 503, json: { error: "Upload rejected" } }
                    : {
                          json: {
                              ok: true,
                              mediaId: 100 + uploads.length,
                              mimeType: "image/png",
                              fileSize: png.length,
                              width: 1,
                              height: 1,
                          },
                      },
            );
            failUpload = false;
        });
        await page.reload();
        const choices = page.locator('[data-field-control="imageOptions"]');
        const rows = choices.locator(".row[data-index]");
        const media = (index: number) => rows.nth(index).locator('[data-item-field="image"]');
        await media(0).getByAltText("First image", { exact: true }).waitFor();
        const label = page.locator('[data-field-control="label"] input');
        const labelNode = await label.elementHandle();
        const box = await label.boundingBox();
        const response = page.waitForResponse("**/uploadChoiceImage?*");
        const chooser = page.waitForEvent("filechooser");
        await media(1).getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles({ name: "second.png", mimeType: "image/png", buffer: png });
        await response;
        await media(1).locator('[data-media-tile] img[src$="id=101"]').waitFor();
        expect(uploads[0]).toEqual({ ref: "question-ref", names: ["second.png"] });
        expect(state.writes).toHaveLength(0);
        expect(state.question.options[1].image).toBeNull();
        expect(await labelNode!.evaluate((e) => e.isConnected)).toBe(true);
        expect(await label.boundingBox()).toEqual(box);
        const saved = page.waitForResponse("**/manageQuestion?ref=question-ref");
        await page.getByRole("button", { name: "Save question", exact: true }).click();
        await saved;
        expect(state.writes[0]!.body).not.toHaveProperty("options");
        expect(state.writes[0]!.body.imageOptions[1].image).toMatchObject({ id: "101" });
        await page.reload();
        await media(1).locator('[data-media-tile] img[src$="id=101"]').waitFor();
        const replaced = page.waitForResponse("**/uploadChoiceImage?*");
        const replaceChooser = page.waitForEvent("filechooser");
        await media(0).locator("[data-media-tile]").click();
        await (await replaceChooser).setFiles({ name: "updated.png", mimeType: "image/png", buffer: png });
        await replaced;
        await media(0).locator('[data-media-tile] img[src$="id=102"]').waitFor();
        expect(state.question.options[0].image.mediaId).toBe("100");
        const replacementSaved = page.waitForResponse("**/manageQuestion?ref=question-ref");
        await page.getByRole("button", { name: "Save question", exact: true }).click();
        await replacementSaved;
        expect(state.writes[1]!.body.imageOptions[0].image).toMatchObject({ id: "102" });
        // A failed replacement restores the persisted original without saving the question.
        failUpload = true;
        const replacement = page.waitForResponse("**/uploadChoiceImage?*");
        const chooseReplacement = page.waitForEvent("filechooser");
        await media(0).locator("[data-media-tile]").click();
        await (await chooseReplacement).setFiles({ name: "replacement.png", mimeType: "image/png", buffer: png });
        await replacement;
        await media(0).locator('[data-media-tile] img[src$="id=102"]').waitFor();
        expect(state.writes).toHaveLength(2);
        await rows.nth(1).getByRole("button", { name: "Remove item", exact: true }).click();
        const removalSaved = page.waitForResponse("**/manageQuestion?ref=question-ref");
        await page.getByRole("button", { name: "Save question", exact: true }).click();
        await removalSaved;
        expect(state.writes[2]!.body.imageOptions).toHaveLength(1);
        expect(uploads).toHaveLength(3);
        await page.screenshot({ animations: "disabled", path: "/tmp/cmscore-forms-image-choices-desktop.png" });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("w13c-left-menu-layout .app-sidebar").waitFor({ state: "hidden" });
        await choices.scrollIntoViewIfNeeded();
        const bounds = await choices.boundingBox();
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
        await page.screenshot({
            animations: "disabled",
            path: "/tmp/cmscore-forms-image-choices-mobile.png",
            fullPage: true,
        });
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25000);
