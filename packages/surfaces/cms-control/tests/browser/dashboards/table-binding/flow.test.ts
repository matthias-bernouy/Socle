import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installTableRoutes } from "./fixture";
import { checkTableStability } from "./stability";
const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("bound tables submit native filters, select rows, download and persist create/edit/clear actions", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installTableRoutes(page, bundle, styles);
        await page.goto("http://cms.test/admin/sources?source=store&dashboard=catalogue");
        const table = page.locator("cms-dashboard-w-table");
        const rows = table.locator("cms-dashboard-w-row");
        await rows.last().waitFor();
        expect(await table.locator('[slot="columns"]').count()).toBe(4);
        expect(
            await table
                .locator("[data-filter-id]")
                .evaluateAll((nodes) => nodes.every((node) => node.getRootNode() === document)),
        ).toBe(true);
        expect(await table.getAttribute("data-config-json")).toBeNull();
        await table.getByRole("checkbox", { name: "Select all rows", exact: true }).check();
        expect(
            await rows
                .getByRole("checkbox")
                .evaluateAll((nodes) => nodes.every((node) => (node as HTMLInputElement).checked)),
        ).toBe(true);
        await table.getByRole("checkbox", { name: "Select all rows", exact: true }).uncheck();
        await checkTableStability(page, fixture);
        const downloaded = page.waitForEvent("download");
        await table.getByRole("button", { name: "Export", exact: true }).click();
        const download = await downloaded;
        expect(download.suggestedFilename()).toBe("products.csv");
        const path = await download.path();
        expect(await Bun.file(path!).text()).toBe("id,name\n1,Alpha\n2,Beta\n3,Gamma");
        await rows.locator('[column="name"]').filter({ hasText: "Alpha" }).click();
        const detail = page.locator("cms-dashboard-w-detail");
        const name = detail.locator('[data-field-control="name"] input');
        await name.fill("  Changed Alpha  ");
        const saved = page.waitForResponse((response) => response.url().endsWith("/save"));
        await detail.getByRole("button", { name: "Save product", exact: true }).click();
        await saved;
        await page.reload();
        await name.waitFor();
        expect(await name.inputValue()).toBe("Changed Alpha");
        await detail.locator("[data-back]:visible").click();
        await rows.last().waitFor();
        expect(await rows.first().textContent()).toContain("Changed Alpha");
        await table.getByRole("button", { name: "New product", exact: true }).click();
        await name.waitFor();
        await detail.getByRole("button", { name: "Save product", exact: true }).click();
        expect(fixture.writes).toHaveLength(1);
        await name.fill("  Delta  ");
        const created = page.waitForResponse((response) => response.url().endsWith("/save"));
        await detail.getByRole("button", { name: "Save product", exact: true }).click();
        await created;
        await page.waitForURL((url) => url.searchParams.get("row") === "4");
        await page.reload();
        await name.waitFor();
        expect(await name.inputValue()).toBe("Delta");
        expect(fixture.writes).toEqual([{ id: "1", name: "  Changed Alpha  " }, { name: "  Delta  " }]);
        await detail.locator("[data-back]:visible").click();
        await rows.last().waitFor();
        await rows.first().getByRole("checkbox").check();
        await table.locator("p9r-open-modal").getByRole("button", { name: "Clear products", exact: true }).click();
        const modal = table.locator("p9r-modal[open]");
        await modal.getByRole("dialog").waitFor();
        await page.keyboard.press("Escape");
        await modal.waitFor({ state: "detached" });
        expect(fixture.clears()).toBe(0);
        await table.locator("p9r-open-modal").getByRole("button", { name: "Clear products", exact: true }).click();
        const cleared = page.waitForResponse((response) => response.url().endsWith("/clear"));
        await modal.getByRole("button", { name: "Clear products", exact: true }).click();
        await cleared;
        await table.getByText("No rows.", { exact: true }).waitFor();
        expect(fixture.clears()).toBe(1);
        await page.reload();
        await table.getByText("No rows.", { exact: true }).waitFor();
        expect(await rows.count()).toBe(0);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25_000);
