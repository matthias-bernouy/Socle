import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installNestedRoutes } from "./fixture";
import { reorderablePage } from "../fixture";
import { imageFile } from "../../../media/fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../../foundation/components/dist/style.css"),
).text();

test("pending nested media preserves current typing and restores the right choice after a failed removal and drag", async () => {
    const browser = await chromium.launch();
    let release = () => {};
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const fixture = await installNestedRoutes(page, bundle, styles);
        await page.goto(reorderablePage);
        const rows = page.locator('[data-field-control="choices"] .row[data-index]');
        const media = (index: number) => rows.nth(index).locator('[data-item-field="photo"]');
        release = fixture.holdMedia();
        const request = page.waitForRequest((value) => new URL(value.url()).pathname.endsWith("/uploadMedia"));
        const upload = page.waitForResponse((value) => new URL(value.url()).pathname.endsWith("/uploadMedia"));
        const chooser = page.waitForEvent("filechooser");
        await media(1).getByRole("button", { name: "Add media", exact: true }).click();
        await (await chooser).setFiles(imageFile);
        await request;
        const label = rows.first().locator('[data-item-field="label"] input');
        await label.fill("Agency typed during upload");
        await label.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 8));
        const before = await label.evaluate((node: HTMLInputElement) => [
            node.value,
            node.matches(":focus"),
            node.selectionStart,
            node.selectionEnd,
        ]);
        release();
        await upload;
        await media(1).locator('[data-media-tile] img[src="/example.svg?asset=1"]').waitFor();
        expect(
            await label.evaluate((node: HTMLInputElement) => [
                node.value,
                node.matches(":focus"),
                node.selectionStart,
                node.selectionEnd,
            ]),
        ).toEqual(before);

        fixture.fail();
        release = fixture.holdMedia();
        const removing = page.waitForRequest((value) => new URL(value.url()).pathname.endsWith("/removeMedia"));
        const removed = page.waitForResponse((value) => new URL(value.url()).pathname.endsWith("/removeMedia"));
        await media(0).locator("[data-media-tile]").hover();
        await media(0).getByRole("button", { name: "Remove media", exact: true }).click();
        await removing;
        await rows.first().locator(".handle").dragTo(rows.last().locator(".handle"));
        await rows.first().locator('[data-item-field="label"] input').fill("Client typed during removal");
        release();
        expect((await removed).status()).toBe(503);
        await page.getByText(/Choice media unavailable/).waitFor();
        await media(1).getByAltText("Agency image", { exact: true }).waitFor();
        await media(0).locator('[data-media-tile] img[src="/example.svg?asset=1"]').waitFor();
        expect(await rows.first().locator('[data-item-field="label"] input').inputValue()).toBe(
            "Client typed during removal",
        );
        const save = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await save;
        await page.reload();
        await media(1).getByAltText("Agency image", { exact: true }).waitFor();
        expect(fixture.resource.choices.map((choice) => [choice.id, choice.label, choice.photo?.id])).toEqual([
            ["client", "Client typed during removal", "uploaded-1"],
            ["agency", "Agency typed during upload", "front"],
        ]);
    } finally {
        release();
        await browser.close();
    }
}, 20_000);
