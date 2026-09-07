import type { Page, Locator } from "playwright";
import { detailUrl, productFixture } from "../fixture";
import { imageFile } from "../../../detail-binding/media/fixture";
export async function setup(page: Page, create = false) {
    const state = await productFixture(page);
    const uploads: Array<{ sessionId: string | null; file: File }> = [];
    let serial = 80;
    let failure = false;
    let waiting: Promise<void> | undefined;
    await page.route("**/stageProductImage*", async (route) => {
        const request = route.request();
        const form = await new Response(new Uint8Array(request.postDataBuffer()!).buffer, {
            headers: { "Content-Type": request.headers()["content-type"]! },
        }).formData();
        uploads.push({
            sessionId: new URL(request.url()).searchParams.get("sessionId"),
            file: form.get("file") as File,
        });
        await waiting;
        await route.fulfill(
            failure
                ? { status: 503, json: { error: "Upload unavailable" } }
                : {
                      json: {
                          sessionId: "upload-session",
                          media: { id: ++serial, name: "Uploaded image", previewUrl: "/preview" },
                      },
                  },
        );
    });
    await page.route("**/productImage*", (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: imageFile.buffer.toString() }),
    );
    await page.route("**/upsertProduct", async (route) => {
        const body = route.request().postDataJSON();
        if (Array.isArray(body.mediaIds) && state.saveStatus === 204) {
            state.current.media = body.mediaIds.map((id: number) => ({ media: { id, alt: `Image ${id}` } }));
        }
        await route.fallback();
    });
    await page.goto(create ? detailUrl.replace("row=42", "row=__new__") : detailUrl);
    const media = page.locator('cms-dashboard-media-field[data-field-control="media"]');
    await media.waitFor();
    return {
        state,
        media,
        uploads,
        fail() {
            failure = true;
        },
        hold() {
            let release = () => {};
            waiting = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
export async function upload(page: Page, media: Locator, files = [imageFile]) {
    const chooser = page.waitForEvent("filechooser");
    await media.getByRole("button", { name: "Add media", exact: true }).click();
    await (await chooser).setFiles(files);
}
