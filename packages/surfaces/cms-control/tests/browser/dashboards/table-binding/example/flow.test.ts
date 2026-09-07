import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
const bundle = await Bun.file(
    resolve(import.meta.dir, "../../../../../src/static/assets/control-components.js"),
).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

test("the local example table binds its products without an endpoint and survives detail navigation", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        page.setDefaultTimeout(5000);
        const requests: string[] = [];
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            requests.push(url.pathname);
            if (url.pathname === "/control.js") {
                await route.fulfill({ contentType: "text/javascript", body: bundle });
            } else if (url.pathname === "/style.css") {
                await route.fulfill({ contentType: "text/css", body: styles });
            } else if (url.pathname === "/network-products") {
                await route.fulfill({ json: [{ id: "network", title: "Network product" }] });
            } else if (route.request().resourceType() === "image") {
                await route.fulfill({
                    contentType: "image/svg+xml",
                    body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
                });
            } else if (route.request().resourceType() === "document") {
                await route.fulfill({
                    contentType: "text/html",
                    body: '<!doctype html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><cms-dashboards-admin example></cms-dashboards-admin></cms-binding-core></body>',
                });
            } else {
                await route.fulfill({ status: 404, json: {} });
            }
        });
        await page.goto("http://cms.test/admin/sources/example");
        const table = page.locator("cms-dashboard-w-table");
        const rows = table.locator("cms-dashboard-w-row");
        await rows.last().waitFor();
        expect(await rows.count()).toBe(4);
        expect(await table.getAttribute("cms-source")).toBe("");
        expect(await table.locator('[slot="columns"]').count()).toBe(5);
        await table.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
        expect(
            await rows
                .getByRole("checkbox")
                .evaluateAll((nodes) => nodes.every((node) => (node as HTMLInputElement).checked)),
        ).toBe(true);
        await table.locator('[column="title"]').filter({ hasText: "Desk Lamp" }).click();
        const detail = page.locator("cms-dashboard-w-detail");
        await detail.locator('[data-field-control="title"] input').waitFor();
        expect(await detail.locator('[data-field-control="title"] input').inputValue()).toBe("Desk Lamp");
        expect(await detail.getAttribute("cms-source")).toBe("");
        expect(
            await detail
                .locator("[data-field-control]")
                .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
        ).toBe(true);
        await page.evaluate(() => {
            (window as unknown as { actions: unknown[] }).actions = [];
            document.addEventListener("cms-dashboard-widget:action", (event) => {
                (window as unknown as { actions: unknown[] }).actions.push((event as CustomEvent).detail);
            });
        });
        const title = detail.locator('[data-field-control="title"] input');
        const description = detail.locator('[data-field-control="description"] textarea');
        await title.fill("Edited lamp");
        await description.click();
        await description.fill("Draft remains focused");
        await description.evaluate((node) => (node as HTMLTextAreaElement).setSelectionRange(3, 8));
        const before = await description.boundingBox();
        await page.evaluate(async () => {
            for (let frame = 0; frame < 5; frame += 1) {
                await new Promise(requestAnimationFrame);
            }
        });
        expect(
            await description.evaluate((node) => ({
                active:
                    node.getRootNode() instanceof ShadowRoot &&
                    (node.getRootNode() as ShadowRoot).activeElement === node,
                start: (node as HTMLTextAreaElement).selectionStart,
                end: (node as HTMLTextAreaElement).selectionEnd,
            })),
        ).toEqual({ active: true, start: 3, end: 8 });
        expect(await description.boundingBox()).toEqual(before);
        await detail.locator('[data-field-control="category"] input').fill("Lighting");
        await detail.locator('[data-field-control="status"]').getByRole("combobox").click();
        await detail
            .locator('[data-field-control="status"]')
            .getByRole("option", { name: "Draft", exact: true })
            .click();
        await detail.locator('[data-field-control="visibility"]').getByRole("combobox").click();
        await detail
            .locator('[data-field-control="visibility"]')
            .getByRole("option", { name: "Hidden", exact: true })
            .click();
        const vendor = detail.locator('[data-field-control="vendor"]');
        await vendor.locator("input").fill("Acme");
        await vendor.getByRole("option", { name: "Acme", exact: true }).click();
        expect(await vendor.locator("input").getAttribute("placeholder")).toBe("Search or add a vendor");
        const tags = detail.locator('[data-field-control="tags"]');
        expect(await tags.getAttribute("placeholder")).toBe("Search or add tags");
        await tags.getByRole("button", { name: "Remove Featured", exact: true }).click();
        await tags.locator("input").fill("Custom tag");
        await tags.locator("input").press("Enter");
        await detail.getByRole("button", { name: "Save changes", exact: true }).click();
        await page.waitForFunction(() => (window as unknown as { actions: unknown[] }).actions.length === 1);
        expect(await page.evaluate(() => (window as unknown as { actions: unknown[] }).actions)).toEqual([
            expect.objectContaining({
                action: "save",
                row: "prod_1001",
                fields: expect.objectContaining({
                    title: "Edited lamp",
                    description: "Draft remains focused",
                    category: "Lighting",
                    status: "Draft",
                    visibility: "Hidden",
                    vendor: "Acme",
                    tags: ["New", "Custom tag"],
                }),
            }),
        ]);
        await detail.locator("[data-back]").click();
        await table.locator('[column="title"]').filter({ hasText: "Edited lamp" }).click();
        await title.waitFor();
        expect(await title.inputValue()).toBe("Edited lamp");
        expect(await description.inputValue()).toBe("Draft remains focused");
        expect(await detail.locator('[data-field-control="category"] input').inputValue()).toBe("Lighting");
        expect(
            await detail
                .locator('[data-field-control="status"]')
                .evaluate((node) => (node as HTMLElement & { value: string }).value),
        ).toBe("Draft");
        expect(
            await detail
                .locator('[data-field-control="visibility"]')
                .evaluate((node) => (node as HTMLElement & { value: string }).value),
        ).toBe("Hidden");
        expect(await vendor.locator("input").inputValue()).toBe("Acme");
        await tags.getByRole("button", { name: "Remove Custom tag", exact: true }).waitFor();
        expect(await tags.getByRole("button", { name: "Remove Featured", exact: true }).count()).toBe(0);
        await detail.locator("[data-back]").click();
        await rows.last().waitFor();
        expect(await rows.count()).toBe(4);
        expect(requests.filter((path) => path.startsWith("/api/") || path.startsWith("/.cms/"))).toEqual([]);
        await table.evaluate((node) => node.setAttribute("cms-source", "/network-products as dashboardData"));
        await table.locator('[column="title"]').filter({ hasText: "Network product" }).waitFor();
        expect(await rows.count()).toBe(1);
        expect(requests.filter((path) => path === "/network-products")).toHaveLength(1);
        await table.evaluate((node) => node.setAttribute("cms-source", ""));
        await page.waitForFunction(() => {
            const core = document.querySelector("cms-binding-core") as HTMLElement & { runtime: { size: number } };
            return core.runtime.size === 0;
        });
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15_000);
