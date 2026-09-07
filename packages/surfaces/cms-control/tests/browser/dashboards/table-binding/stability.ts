import { expect } from "bun:test";
import type { Page } from "playwright";
import type { installTableRoutes } from "./fixture";
export async function checkTableStability(page: Page, fixture: Awaited<ReturnType<typeof installTableRoutes>>) {
    const table = page.locator("cms-dashboard-w-table");
    const search = table.locator('[data-filter-id="q"]');
    const status = table.locator('[data-filter-id="status"]');
    const rows = table.locator("cms-dashboard-w-row");
    await search.fill("Alpha");
    const release = fixture.hold("Alpha");
    const requested = page.waitForRequest((request) => request.url().includes("q=Alpha"));
    const response = page.waitForResponse((response) => response.url().includes("q=Alpha"));
    await search.press("Enter");
    await requested;
    await search.fill("New draft");
    await search.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 4));
    const nav = page.locator("cms-dashboards-nav");
    const navBox = await nav.boundingBox();
    const form = table.locator("[data-filters]");
    const box = await form.boundingBox();
    try {
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
            expect(await form.boundingBox()).toEqual(box);
            expect(await nav.boundingBox()).toEqual(navBox);
            expect(await search.inputValue()).toBe("New draft");
        }
    } finally {
        release();
    }
    await response;
    await page.waitForFunction(() => document.querySelectorAll("cms-dashboard-w-row").length === 1);
    expect(await search.inputValue()).toBe("New draft");
    expect(
        await search.evaluate((node: HTMLInputElement) => [
            document.activeElement === node,
            node.selectionStart,
            node.selectionEnd,
        ]),
    ).toEqual([true, 1, 4]);
    const releaseOld = fixture.hold("Gamma");
    await search.fill("Gamma");
    const old = page.waitForRequest((request) => request.url().includes("q=Gamma"));
    await search.press("Enter");
    await old;
    await search.fill("Beta");
    const latest = page.waitForResponse((response) => response.url().includes("q=Beta"));
    await search.press("Enter");
    await latest;
    releaseOld();
    await page.waitForFunction(
        () => document.querySelector('cms-dashboard-w-row [column="name"]')?.textContent === "Beta",
    );
    await page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    );
    expect(await rows.first().textContent()).toContain("Beta");
    expect(await search.inputValue()).toBe("Beta");
    fixture.fail("Failure");
    await search.fill("Failure");
    const failed = page.waitForResponse((response) => response.status() === 503);
    await search.press("Enter");
    await failed;
    await table.locator('p9r-alert[type="error"]').waitFor();
    const retried = page.waitForResponse(
        (response) => response.url().includes("q=Failure") && response.status() === 200,
    );
    await table.getByRole("button", { name: "Retry", exact: true }).click();
    await retried;
    await table.locator('p9r-alert[type="error"]').waitFor({ state: "detached" });
    await table.getByText("No rows.", { exact: true }).waitFor();
    const cleared = page.waitForResponse((response) => response.url().endsWith("/items"));
    await table.getByRole("button", { name: "Clear filters", exact: true }).click();
    await cleared;
    await page.waitForFunction(() => document.querySelectorAll("cms-dashboard-w-row").length === 3);
    expect(await search.inputValue()).toBe("");
    await status.selectOption("active");
    const filtered = page.waitForResponse((response) => response.url().includes("status=active"));
    await table.getByRole("button", { name: "Apply filters", exact: true }).click();
    await filtered;
    await page.waitForFunction(() => document.querySelectorAll("cms-dashboard-w-row").length === 2);
    const reset = page.waitForResponse((response) => response.url().endsWith("/items"));
    await table.getByRole("button", { name: "Clear filters", exact: true }).click();
    await reset;
    await page.waitForFunction(() => document.querySelectorAll("cms-dashboard-w-row").length === 3);
}
