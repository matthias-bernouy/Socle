import { expect, test } from "bun:test";
import { chromium, type Page } from "playwright";
import { productFixture, detailUrl } from "../fixture";

const listUrl = "http://cms.test/admin/sources?source=commerce&dashboard=products";
const titleInput = '[data-detail-save] [name="title"] input';

async function recordedLayout(page: Page, name: string, width: number) {
    await page.screenshot({
        path: `/tmp/cmscore-unified-${name}-${width}.png`,
        fullPage: true,
        animations: "disabled",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(await page.locator("form form").count()).toBe(0);
}

for (const width of [1440, 390]) {
    test(`product creation uses the full page then navigates and edits the persisted record at ${width}px`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            page.setDefaultTimeout(6000);
            page.on("dialog", (dialog) => dialog.accept());
            const state = await productFixture(page);
            await page.goto(listUrl);
            await page.getByRole("button", { name: "Create product", exact: true }).click();
            await page.locator(titleInput).fill("Cancelled product");
            expect(await page.locator("p9r-modal[open]").count()).toBe(0);
            await page.getByRole("button", { name: "Back to table", exact: true }).click();
            expect(state.creates).toEqual([]);
            await page.getByRole("button", { name: "Create product", exact: true }).click();
            await page.locator(titleInput).fill("New draft");
            await page.locator('[data-detail-save] [name="description"] textarea').fill("Complete product draft");
            expect(await page.locator('[data-detail-save] [name="mediaIds"]').count()).toBe(1);
            await recordedLayout(page, "product-new", width);
            const reads = state.reads;
            state.saveDelay = 80;
            state.readDelay = 120;
            const started = Date.now();
            await page.getByRole("button", { name: "Save product", exact: true }).click();
            await page.waitForURL((url) => url.searchParams.get("row") === "43");
            await page.waitForFunction(
                () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "1",
            );
            expect(Date.now() - started).toBeGreaterThanOrEqual(180);
            expect(Date.now() - started).toBeLessThan(4000);
            expect(state.creates).toHaveLength(1);
            expect(state.creates[0]).toMatchObject({
                title: "New draft",
                description: "Complete product draft",
                creationToken: expect.any(String),
            });
            expect(state.creates[0]).not.toHaveProperty("id");
            expect(state.creates[0]).not.toHaveProperty("expectedVersion");
            expect(state.reads).toBe(reads + 1);
            expect(state.productReads.at(-1)).toContain("id=43");
            await page.locator(titleInput).fill("Edited saved product");
            await page.getByRole("button", { name: "Save product", exact: true }).click();
            await page.waitForFunction(
                () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "2",
            );
            expect(state.writes[0]).toMatchObject({ id: 43, expectedVersion: 1, title: "Edited saved product" });
            expect(state.reads).toBe(reads + 2);
            expect(state.current).toMatchObject({ status: "draft", visibility: "hidden", version: 2 });
            await recordedLayout(page, "product-saved", width);
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 25000);

    test(`brand creation and editing share a full modal and preserve the parent draft at ${width}px`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            page.setDefaultTimeout(6000);
            const state = await productFixture(page);
            await page.goto(detailUrl);
            const title = page.locator(titleInput);
            await title.fill("Product draft");
            const parentTitle = await title.elementHandle();
            const shortcut = page.locator("p9r-icon-button[data-lookup-create]");
            expect(await shortcut.getAttribute("aria-label")).toBe("Create brand");
            await shortcut.locator("button").focus();
            await page.keyboard.press("Enter");
            const modal = page.locator('p9r-modal[aria-label="Create brand"]');
            await modal.locator('[name="name"] input').fill("New brand");
            await modal.locator('[name="slug"] input').fill("new-brand");
            await modal.locator('[name="description"] textarea').fill("Full brand description");
            expect(await modal.locator('[name="status"]').count()).toBe(1);
            await recordedLayout(page, "brand-create", width);
            await modal.getByRole("button", { name: "Save brand", exact: true }).click();
            await modal.waitFor({ state: "detached" });
            expect(state.brands[0]).toMatchObject({
                name: "New brand",
                slug: "new-brand",
                description: "Full brand description",
                status: "active",
            });
            expect(state.brands[0]).not.toHaveProperty("id");
            expect(state.brandReads).toEqual([""]);
            expect(await page.locator('p9r-combobox[name="brandId"]').getAttribute("value")).toBe("9");
            expect(state.current.brandId).toBe(1);
            expect(await title.inputValue()).toBe("Product draft");
            await page.locator("p9r-icon-button[data-lookup-edit]").click();
            const edit = page.locator('p9r-modal[aria-label="Edit brand"]');
            await edit.locator('[name="name"] input').fill("Renamed brand");
            expect(await edit.locator('[name="description"] textarea').inputValue()).toBe("Full brand description");
            state.brandSaveDelay = 80;
            state.brandReadDelay = 120;
            await recordedLayout(page, "brand-edit", width);
            const started = Date.now();
            await edit.getByRole("button", { name: "Save brand", exact: true }).click();
            await edit.waitFor({ state: "detached" });
            expect(Date.now() - started).toBeGreaterThanOrEqual(180);
            expect(state.brandReads.filter((query) => query.includes("id=9"))).toHaveLength(2);
            expect(state.brands[1]).toMatchObject({ id: 9, expectedVersion: 1, name: "Renamed brand" });
            expect(await page.locator('p9r-combobox[name="brandId"] input').inputValue()).toBe("Renamed brand");
            expect(state.writes).toEqual([]);
            expect(await title.inputValue()).toBe("Product draft");
            expect(await parentTitle!.evaluate((node) => node.isConnected)).toBe(true);
            expect(new URL(page.url()).searchParams.get("row")).toBe("42");
            await page.getByRole("button", { name: "Save product", exact: true }).click();
            await page.waitForFunction(
                () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
            );
            expect(state.current.brandId).toBe(9);
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 25000);
}

for (const navigation of [true, "detail"] as const) {
    test(`navigation-list creation (${navigation}) opens the common product page`, async () => {
        const browser = await chromium.launch();
        try {
            const page = await browser.newPage();
            page.setDefaultTimeout(6000);
            const state = await productFixture(page, { navigation });
            await page.goto(navigation === "detail" ? detailUrl : listUrl);
            await page.getByRole("button", { name: "Create product", exact: true }).click();
            await page.locator(titleInput).fill("Navigation draft");
            expect(await page.locator("p9r-modal[open]").count()).toBe(0);
            await page.getByRole("button", { name: "Save product", exact: true }).click();
            await page.waitForURL((url) => url.searchParams.get("row") === "43");
            expect(state.creates).toHaveLength(1);
            expect(state.creates[0]?.title).toBe("Navigation draft");
            expect(await page.locator("form form").count()).toBe(0);
            expect(state.errors).toEqual([]);
        } finally {
            await browser.close();
        }
    }, 20000);
}
