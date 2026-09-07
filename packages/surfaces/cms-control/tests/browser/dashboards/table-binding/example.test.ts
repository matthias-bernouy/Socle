import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
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
