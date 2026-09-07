import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { productFixture, detailUrl } from "./fixture";

test("independent actions keep confirmation and use only their form, then reload the shared revision", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const actions = [
            {
                id: "archive",
                label: "Archive product",
                confirm: "Archive this product?",
                tone: "danger",
                form: {
                    endpoint: "archiveProduct",
                    hiddenFields: [
                        { name: "id", value: "$resource.id", type: "number" },
                        { name: "expectedVersion", value: "$resource.version", type: "number" },
                    ],
                },
            },
        ];
        const state = await productFixture(page, { actions });
        const writes: unknown[] = [];
        await page.route("**/archiveProduct", async (route) => {
            writes.push(route.request().postDataJSON());
            state.current.status = "archived";
            state.current.version++;
            await route.fulfill({ status: 204 });
        });
        await page.goto(detailUrl);
        await page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Archive product", exact: true })
            .click();
        const modal = page.locator("p9r-modal[open]");
        expect(await modal.innerText()).toContain("Archive this product?");
        expect(writes).toEqual([]);
        await page.keyboard.press("Escape");
        await page.locator('[data-detail-save] [name="title"] input').fill("Unsaved title");
        await page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Archive product", exact: true })
            .click();
        await modal.getByRole("button", { name: "Archive product", exact: true }).click();
        expect(writes).toEqual([]);
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        await page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Archive product", exact: true })
            .click();
        await modal.getByRole("button", { name: "Archive product", exact: true }).click();
        await page.waitForFunction(
            () => document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "9",
        );
        expect(writes).toEqual([{ id: 42, expectedVersion: 8 }]);
        expect(await modal.count()).toBe(0);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("a completed operation with a failed read cannot be replayed and resumes navigation after GET retry", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const state = await productFixture(page, {
            actions: [
                {
                    id: "archive",
                    label: "Archive product",
                    confirm: "Archive this product?",
                    form: {
                        endpoint: "archiveProduct",
                        hiddenFields: [{ name: "id", value: "$resource.id", type: "number" }],
                    },
                    after: { opens: "productDetail", row: "$selection.id" },
                },
            ],
        });
        const writes: unknown[] = [];
        await page.route("**/archiveProduct", async (route) => {
            writes.push(route.request().postDataJSON());
            state.current.version++;
            await route.fulfill({ status: 204 });
        });
        await page.goto(detailUrl);
        await page.evaluate(() => {
            (window as any).operationSelections = [];
            document.addEventListener(
                "cms-dashboard-widget:row-select",
                (event) => (window as any).operationSelections.push((event as CustomEvent).detail),
                true,
            );
        });
        await page.locator('[data-detail-save] [name="title"] input').waitFor();
        state.readStatus = 503;
        await page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Archive product", exact: true })
            .click();
        const modal = page.locator("p9r-modal[open]");
        await modal.getByRole("button", { name: "Archive product", exact: true }).click();
        await page.locator("[data-operation-awaiting-read]").waitFor();
        await modal.getByRole("button", { name: "Archive product", exact: true }).click();
        expect(writes).toEqual([{ id: 42 }]);
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Save product", exact: true }).click();
        expect(state.writes).toEqual([]);
        state.readStatus = 200;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.waitForFunction(
            () =>
                !document.querySelector("[data-operation-awaiting-read]") &&
                document.querySelector<HTMLInputElement>('input[name="expectedVersion"]')?.value === "8",
        );
        expect(writes).toHaveLength(1);
        expect(await page.locator("p9r-modal[open]").count()).toBe(0);
        expect(await page.evaluate(() => (window as any).operationSelections)).toContainEqual(
            expect.objectContaining({ collection: "productDetail", rowKey: "42" }),
        );
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("action visibility is evaluated independently and missing technical identity blocks submission", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const state = await productFixture(page, {
            actions: [
                {
                    id: "archive",
                    label: "Archive product",
                    visibleWhen: { value: "$resource.status", equals: "draft" },
                    form: {
                        endpoint: "archiveProduct",
                        hiddenFields: [{ name: "id", value: "$resource.missingIdentity", type: "number" }],
                    },
                },
            ],
        });
        let writes = 0;
        await page.route("**/archiveProduct", (route) => {
            writes++;
            return route.fulfill({ status: 204 });
        });
        await page.goto(detailUrl);
        const action = page
            .locator('[slot="bound-actions"]')
            .getByRole("button", { name: "Archive product", exact: true });
        await action.click();
        await page.waitForFunction(() =>
            Array.from(document.querySelectorAll("p9r-toast")).some(
                (toast) => toast.textContent === "The operation identity or revision is missing. Reload the detail.",
            ),
        );
        expect(writes).toBe(0);
        state.current.status = "archived";
        await page.evaluate(() =>
            document
                .querySelector("cms-dashboard-w-detail")!
                .dispatchEvent(new Event("cms-source:reload", { bubbles: true })),
        );
        await action.waitFor({ state: "detached" });
        state.current.status = "draft";
        await page.evaluate(() =>
            document
                .querySelector("cms-dashboard-w-detail")!
                .dispatchEvent(new Event("cms-source:reload", { bubbles: true })),
        );
        await action.waitFor();
        expect(writes).toBe(0);
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);

test("admin filters are installed before an existing binding core connects", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(6000);
        const state = await productFixture(page, {
            titleVisibleWhen: { value: "$resource.status", equals: "draft" },
        });
        await page.goto(detailUrl);
        const title = page.locator('[data-detail-save] [name="title"] input');
        await title.waitFor();
        state.current.status = "archived";
        await page.evaluate(() =>
            document
                .querySelector("cms-dashboard-w-detail")!
                .dispatchEvent(new Event("cms-source:reload", { bubbles: true })),
        );
        await title.waitFor({ state: "detached" });
        expect(state.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
