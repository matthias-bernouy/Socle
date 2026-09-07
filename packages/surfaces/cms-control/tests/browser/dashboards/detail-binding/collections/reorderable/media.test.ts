import { expect, test } from "bun:test";
import { chromium, type Page } from "playwright";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { installNestedRoutes } from "./nested.fixture";
import { reorderablePage } from "./fixture";
import { imageFile } from "../../media/fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("nested media assets upload, replace and remove before their parent choices persist on save", async () => {
    const browser = await chromium.launch();
    let release: (() => void) | undefined;
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installNestedRoutes(page, bundle, styles);
        await page.goto(reorderablePage);
        const rows = page.locator('[data-field-control="choices"] .row[data-index]');
        const media = (index: number) => rows.nth(index).locator('[data-item-field="photo"]');
        await media(0).getByAltText("Agency image", { exact: true }).waitFor();
        await capture(page, "ready");
        release = fixture.holdMedia();
        const upload = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/uploadMedia"));
        const request = page.waitForRequest((value) => new URL(value.url()).pathname.endsWith("/uploadMedia"));
        const chooser = page.waitForEvent("filechooser");
        await media(1).getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles(imageFile);
        await request;
        const notes = page.locator('[data-field-control="notes"] textarea');
        await notes.fill("Notes entered during upload");
        expect(fixture.resource.choices[1]!.photo).toBeNull();
        release();
        await upload;
        await media(1).locator('img[src="/example.svg?asset=1"]').waitFor();
        expect(await notes.inputValue()).toBe("Notes entered during upload");
        expect(await notes.evaluate((node) => (node.getRootNode() as ShadowRoot).activeElement === node)).toBe(true);
        expect(fixture.calls[0]!.params).toEqual({ choice: "client" });
        expect(fixture.calls[0]!.files).toHaveLength(1);
        expect(await fixture.calls[0]!.files[0]!.text()).toBe(imageFile.buffer.toString());
        expect(fixture.resource.choices[1]!.photo).toBeNull();
        await capture(page, "uploaded-draft");
        await save(page);
        await page.reload();
        await media(1).locator('img[src="/example.svg?asset=1"]').waitFor();
        expect(fixture.resource.choices[1]!.photo).toEqual({
            id: "uploaded-1",
            url: "/example.svg?asset=1",
            alt: imageFile.name,
        });

        const replace = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/replaceMedia"));
        const replacementChooser = page.waitForEvent("filechooser");
        await media(0).locator("[data-media-tile]").click();
        await (await replacementChooser).setFiles({ ...imageFile, name: "quality-replacement.svg" });
        await replace;
        await media(0).locator('img[src="/example.svg?asset=2"]').waitFor();
        expect(fixture.calls[1]!.params).toEqual({ choice: "agency", previous: "front" });
        const remove = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/removeMedia"));
        await media(1).locator("[data-media-tile]").hover();
        await media(1).getByRole("button", { name: "Remove media", exact: true }).click();
        await remove;
        await media(1).getByRole("button", { name: "Add media", exact: true }).waitFor();
        expect(fixture.calls[2]!.body).toEqual({ choice: "client", id: "uploaded-1" });
        await save(page);
        await page.reload();
        await media(0).locator('img[src="/example.svg?asset=2"]').waitFor();
        await media(1).getByRole("button", { name: "Add media", exact: true }).waitFor();
        expect(fixture.resource.choices[0]!.photo).toEqual({
            id: "uploaded-2",
            url: "/example.svg?asset=2",
            alt: "quality-replacement.svg",
        });
        expect(fixture.resource.choices[1]!.photo).toBeNull();
        expect(fixture.resource.choices.map((choice) => choice.hidden)).toEqual(["first", "second"]);
        expect(fixture.resource.notes).toBe("Notes entered during upload");
        expect(fixture.calls).toHaveLength(3);
        await capture(page, "saved");
        expect(errors).toEqual([]);
    } finally {
        release?.();
        await browser.close();
    }
}, 20_000);

async function save(page: Page) {
    const response = page.waitForResponse((value) => value.url().endsWith("/save"));
    await page.getByRole("button", { name: "Save choices", exact: true }).click();
    expect((await response).ok()).toBe(true);
}

async function capture(page: Page, state: string) {
    const directory = process.env.CMS_REORDERABLE_NESTED_CAPTURES;
    if (directory) {
        await mkdir(directory, { recursive: true });
        await page.screenshot({ path: `${directory}/nested-${state}.png`, fullPage: true, animations: "disabled" });
    }
}
