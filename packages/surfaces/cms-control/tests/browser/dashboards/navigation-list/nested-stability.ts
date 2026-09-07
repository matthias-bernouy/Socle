import { expect } from "bun:test";
import type { Page } from "playwright";
import type { installNestedRoutes } from "./nested-fixture";

export async function checkNestedStability(page: Page, fixture: Awaited<ReturnType<typeof installNestedRoutes>>) {
    const parent = page.locator('cms-dashboard-w-detail[data-widget-id="parent"]');
    const list = parent.locator("cms-dashboard-w-navigation-list");
    const source = list.locator("[cms-source]");
    fixture.failChildren();
    const parentReads = fixture.reads.filter((path) => path.endsWith("/parent")).length;
    const failed = page.waitForResponse(
        (response) => response.url().endsWith("/children") && response.status() === 503,
    );
    await source.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
    await failed;
    await list.locator('p9r-alert[type="error"]').waitFor();
    const retry = page.waitForResponse((response) => response.url().endsWith("/children") && response.status() === 200);
    await list.getByRole("button", { name: "Retry", exact: true }).click();
    await retry;
    await list.locator('p9r-alert[type="error"]').waitFor({ state: "detached" });
    expect(fixture.reads.filter((path) => path.endsWith("/parent"))).toHaveLength(parentReads);
    const note = parent.locator('[data-field-control="note"] textarea');
    await note.fill("An unsaved note");
    await note.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(2, 7));
    const content = page.locator("w13c-left-menu-layout main");
    const scroll = await content.evaluate((node) => node.scrollTop);
    expect(scroll).toBeGreaterThan(0);
    const box = await list.boundingBox();
    const nav = page.locator("cms-dashboards-nav");
    const navBox = await nav.boundingBox();
    const childReads = fixture.reads.filter((path) => path.endsWith("/children")).length;
    const release = fixture.holdParent();
    const request = page.waitForRequest((request) => request.url().endsWith("/parent"));
    const response = page.waitForResponse((response) => response.url().endsWith("/parent"));
    await parent.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
    await request;
    try {
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
            expect(await list.boundingBox()).toEqual(box);
            expect(await nav.boundingBox()).toEqual(navBox);
            expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
            expect(await note.inputValue()).toBe("An unsaved note");
        }
    } finally {
        release();
    }
    await response;
    await page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    );
    expect(await list.boundingBox()).toEqual(box);
    expect(await note.inputValue()).toBe("An unsaved note");
    expect(
        await note.evaluate((node: HTMLTextAreaElement) => [
            (node.getRootNode() as ShadowRoot).activeElement === node,
            node.selectionStart,
            node.selectionEnd,
        ]),
    ).toEqual([true, 2, 7]);
    expect(fixture.reads.filter((path) => path.endsWith("/children"))).toHaveLength(childReads);
}
