import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installNestedRoutes } from "./media/fixture";
import { reorderablePage } from "./fixture";

const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../../foundation/components/dist/style.css"),
).text();

test("nested page and secret references stay with their choice through drag, save, clear and reload", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installNestedRoutes(page, bundle, styles);
        await page.goto(reorderablePage);
        const rows = page.locator('[data-field-control="choices"] .row[data-index]');
        await rows.first().locator("summary").click();
        const picker = rows.first().locator('[data-item-field="page"]');
        await picker.getByPlaceholder("Search pages").click();
        await picker.getByRole("button", { name: "Privacy /privacy", exact: true }).click();
        const credential = rows.first().locator('[data-item-field="credential"]');
        await credential.getByRole("combobox").click();
        await credential.getByRole("option", { name: "QUALITY_SECOND", exact: true }).click();
        await rows.first().locator(".handle").dragTo(rows.last().locator(".handle"));
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        expect((await saved).ok()).toBe(true);
        expect(fixture.saved[0]!.choices).toEqual([
            { id: "client", label: "Client", page: "", credential: "", photo: null, position: 0, hidden: "second" },
            {
                id: "agency",
                label: "Agency",
                page: "/privacy",
                credential: "${QUALITY_SECOND}",
                photo: { id: "front", url: "/example.svg", alt: "Agency image" },
                position: 1,
                hidden: "first",
            },
        ]);
        await page.reload();
        await rows.last().locator("summary").click();
        expect(
            await rows
                .last()
                .locator('[data-item-field="page"]')
                .evaluate((node) => (node as HTMLElement & { value: string }).value),
        ).toBe("/privacy");
        expect(
            await rows
                .last()
                .locator('[data-item-field="credential"]')
                .evaluate((node) => (node as HTMLElement & { value: string }).value),
        ).toBe("${QUALITY_SECOND}");
        await rows.last().getByRole("button", { name: "Remove credential", exact: true }).click();
        const secondSave = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save choices", exact: true }).click();
        await secondSave;
        await page.reload();
        await rows.last().locator("summary").click();
        expect(
            await rows
                .last()
                .locator('[data-item-field="credential"]')
                .evaluate((node) => (node as HTMLElement & { value: string }).value),
        ).toBe("");
        expect(fixture.resource.choices[1]!.credential).toBe("");
        expect(fixture.resource.choices[1]!.page).toBe("/privacy");
        expect(fixture.pageReads.length).toBeGreaterThan(0);
        expect(fixture.pageReads.every((url) => new URL(url).searchParams.get("visible") === "published")).toBe(true);
        expect(fixture.secretReads).toEqual(["GET"]);
        expect(fixture.calls).toEqual([]);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20_000);
