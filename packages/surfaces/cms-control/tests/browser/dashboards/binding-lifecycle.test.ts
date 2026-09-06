import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";

const bundle = await Bun.file(resolve(import.meta.dir, "../../../src/static/assets/control-components.js")).text();
const group = {
    source: { id: "store", urn: "urn:store", name: "Store", endpointCount: 3, dashboardCount: 1, readonly: false },
    endpoints: [
        { endpointId: "items", method: "GET", params: [] },
        { endpointId: "item", method: "GET", params: [] },
        { endpointId: "save", method: "PUT", params: [] },
    ],
    dashboards: [
        {
            id: "catalogue",
            source: "store",
            meta: { name: "Catalogue" },
            views: [
                {
                    widget: "w-table",
                    id: "items",
                    source: { endpoint: "items", itemsPath: "items", params: { q: "$filter.q" } },
                    rowKey: "id",
                    columns: [{ id: "name", label: "Name", path: "name", primary: true }],
                    filters: [{ id: "q", label: "Search", type: "text" }],
                    selection: { opens: "detail" },
                },
                {
                    widget: "w-detail",
                    id: "detail",
                    source: { endpoint: "item", params: { id: "$selection.id" } },
                    title: { path: "name" },
                    actions: [
                        {
                            id: "save",
                            label: "Save item",
                            endpoint: { endpoint: "save", body: { name: "$field.name" } },
                            after: { resource: "$result" },
                        },
                    ],
                    main: [
                        {
                            id: "general",
                            title: "General",
                            fields: [
                                { id: "name", label: "Name", path: "name", type: "text", required: true },
                                ...Array.from({ length: 20 }, (_, index) => ({
                                    id: `notes${index}`,
                                    label: `Notes ${index}`,
                                    path: `notes${index}`,
                                    type: "text",
                                })),
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

test("page-owned bindings preserve navigation, filtered tables and detail hosts across reloads and saves", async () => {
    const browser = await chromium.launch();
    let release = () => {};
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.setDefaultTimeout(6000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        let resource = { id: "1", name: "First item" };
        let delay: Promise<void> | undefined;
        let failDetail = true;
        let saves = 0;
        await page.route("http://cms.test/**", async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === "/control.js") {
                await route.fulfill({ contentType: "text/javascript", body: bundle });
            } else if (request.resourceType() === "document") {
                await route.fulfill({
                    contentType: "text/html",
                    body: '<!doctype html><head><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core></body>',
                });
            } else if (url.pathname === "/api/dashboards") {
                await route.fulfill({ json: [group] });
            } else if (url.pathname.endsWith("/items")) {
                if (delay) {
                    await delay;
                }
                await route.fulfill({ json: { items: [resource] } });
            } else if (url.pathname.endsWith("/item")) {
                if (failDetail) {
                    failDetail = false;
                    await route.fulfill({ status: 503, json: { error: "Unavailable" } });
                } else {
                    await route.fulfill({ json: resource });
                }
            } else if (url.pathname.endsWith("/save")) {
                saves += 1;
                resource = { ...resource, ...request.postDataJSON() };
                await route.fulfill({ json: resource });
            } else {
                await route.fulfill({ json: [] });
            }
        });
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=catalogue", {
            waitUntil: "domcontentloaded",
        });
        const row = page.locator("cms-dashboard-w-row");
        await row.waitFor();
        const nav = await page.locator('cms-dashboards-nav [data-source="store"]').elementHandle();
        const table = await page.locator("cms-dashboard-w-table").elementHandle();
        await page.evaluate(() => document.dispatchEvent(new Event("dashboard:definitions-changed")));
        await page.waitForTimeout(100);
        expect(await nav!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await table!.evaluate((node) => node.isConnected)).toBe(true);
        const originalRow = await row.elementHandle();
        delay = new Promise<void>((resolve) => {
            release = resolve;
        });
        await page.locator('cms-dashboard-w-table input[name="q"]').fill("First");
        const requested = page.waitForRequest((request) => request.url().includes("/items?q=First"));
        await page.getByRole("button", { name: "Apply filters", exact: true }).click();
        await requested;
        expect(await originalRow!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await table!.evaluate((node) => node.isConnected)).toBe(true);
        release();
        await row.locator("[role=row]").click();
        await page.getByRole("alert").filter({ hasText: "Unable to load this data" }).waitFor();
        expect(await page.getByRole("button", { name: "Save item", exact: true }).count()).toBe(0);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        const input = page.locator('cms-dashboard-w-detail [data-field-control="name"] input');
        await input.fill("Updated item");
        const originalInput = await input.elementHandle();
        const detail = await page.locator("cms-dashboard-w-detail").elementHandle();
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await page.getByRole("button", { name: "Save item", exact: true }).click();
        expect((await saved).status()).toBe(200);
        await page.waitForTimeout(100);
        expect(await originalInput!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await input.inputValue()).toBe("Updated item");
        expect(saves).toBe(1);
        expect(resource.name).toBe("Updated item");
        expect(await detail!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await nav!.evaluate((node) => node.isConnected)).toBe(true);
        expect(await page.locator("cms-binding-core").count()).toBe(1);
        expect(await page.locator("[data-config-json], [data-source-json], [data-filters-json]").count()).toBe(0);
        expect(
            await page
                .locator("cms-dashboards-admin [cms-source]")
                .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
        ).toBe(true);
        const lowerInput = page.locator('cms-dashboard-w-detail [data-field-control="notes19"] input');
        await lowerInput.fill("Keep this draft");
        const lowerNode = await lowerInput.elementHandle();
        const positions = await page.evaluate(scrollPositions);
        expect(positions.some((position) => position > 0)).toBe(true);
        await page.evaluate(() => document.dispatchEvent(new Event("dashboard:definitions-changed")));
        await page.waitForTimeout(150);
        expect(await lowerNode!.evaluate((node) => node.isConnected && node.matches(":focus"))).toBe(true);
        expect(await lowerInput.inputValue()).toBe("Keep this draft");
        expect(await page.evaluate(scrollPositions)).toEqual(positions);
        expect(errors).toEqual([]);
    } finally {
        release();
        await browser.close();
    }
}, 30000);

function scrollPositions(): number[] {
    const positions: number[] = [];
    const visit = (root: Document | ShadowRoot): void => {
        for (const node of Array.from(root.querySelectorAll("*"))) {
            if (node.scrollTop > 0) {
                positions.push(node.scrollTop);
            }
            if (node.shadowRoot) {
                visit(node.shadowRoot);
            }
        }
    };
    visit(document);
    return positions;
}
