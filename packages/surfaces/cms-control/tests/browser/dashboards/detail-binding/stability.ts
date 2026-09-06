import { expect } from "bun:test";
import type { Page } from "playwright";

export async function checkRefreshStability(page: Page, hold: () => () => void): Promise<void> {
    const detail = page.locator("cms-dashboard-w-detail");
    const input = detail.locator('p9r-input[data-field-control="title"] input');
    const content = page.locator("w13c-left-menu-layout main");
    await input.fill("Unsaved title");
    await input.evaluate((node: HTMLInputElement) => node.setSelectionRange(2, 5));
    await content.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
    });
    const scroll = await content.evaluate((node) => node.scrollTop);
    expect(scroll).toBeGreaterThan(0);
    const imagePosition = await detail.locator("img").boundingBox();
    const navigation = await page.locator("w13c-left-menu-layout .mobile-toolbar").boundingBox();
    const release = hold();
    const requested = page.waitForRequest((request) => request.url().endsWith("/item"));
    const response = page.waitForResponse((item) => item.url().endsWith("/item"));
    try {
        await detail.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
        await requested;
        for (let frame = 0; frame < 5; frame += 1) {
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
            expect(await detail.locator("img").boundingBox()).toEqual(imagePosition);
            expect(await page.locator("w13c-left-menu-layout .mobile-toolbar").boundingBox()).toEqual(navigation);
            expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
            expect(await input.inputValue()).toBe("Unsaved title");
        }
    } finally {
        release();
    }
    await response;
    await page.waitForFunction(
        () => !document.querySelector('cms-dashboard-w-detail [cms-condition="$source.loading"]'),
    );
    expect(await input.inputValue()).toBe("Unsaved title");
    expect(
        await input.evaluate((node: HTMLInputElement) => [
            node.selectionStart,
            node.selectionEnd,
            node === (node.getRootNode() as ShadowRoot).activeElement,
        ]),
    ).toEqual([2, 5, true]);
    expect(await content.evaluate((node) => node.scrollTop)).toBe(scroll);
    expect(await detail.locator("img").boundingBox()).toEqual(imagePosition);
}
