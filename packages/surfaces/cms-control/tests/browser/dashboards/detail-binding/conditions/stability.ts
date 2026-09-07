import { expect } from "bun:test";
import type { Page } from "playwright";
import type { installConditionalRoutes } from "./fixture";

export async function checkPendingSaveAndReadFailure(
    page: Page,
    fixture: Awaited<ReturnType<typeof installConditionalRoutes>>,
) {
    const detail = page.locator("cms-dashboard-w-detail");
    const name = detail.locator('[data-field-control="name"] input');
    const price = detail.locator('[data-field-control="price"] input');
    const save = page.getByRole("button", { name: "Save choices", exact: true });
    await name.fill("  Second name  ");
    const release = fixture.holdSave();
    const request = page.waitForRequest((result) => result.url().endsWith("/save"));
    const response = page.waitForResponse((result) => result.url().endsWith("/save"));
    await save.click();
    await request;
    await name.fill("Newer unsaved name");
    await price.fill("23,45");
    await price.evaluate((node: HTMLInputElement) => node.setSelectionRange(1, 3));
    const box = await detail.boundingBox();
    release();
    await response;
    await frames(page);
    expect(await detail.boundingBox()).toEqual(box);
    expect(await name.inputValue()).toBe("Newer unsaved name");
    expect(await price.inputValue()).toBe("23,45");
    expect(
        await price.evaluate((node: HTMLInputElement) => [
            (node.getRootNode() as ShadowRoot).activeElement === node,
            node.selectionStart,
            node.selectionEnd,
        ]),
    ).toEqual([true, 1, 3]);
    fixture.failRead();
    const failed = page.waitForResponse((result) => result.url().endsWith("/item") && result.status() === 503);
    await detail.evaluate((node) => document.dispatchEvent(new Event(node.getAttribute("cms-reload-on")!)));
    await failed;
    await detail.locator('p9r-alert[type="error"]').waitFor();
    expect(await name.inputValue()).toBe("Newer unsaved name");
    expect(await price.inputValue()).toBe("23,45");
    const retried = page.waitForResponse((result) => result.url().endsWith("/item") && result.status() === 200);
    await detail.locator("[data-dashboard-source-retry]").click();
    await retried;
    await frames(page);
    expect(await name.inputValue()).toBe("Newer unsaved name");
    expect(await price.inputValue()).toBe("23,45");
    const saved = page.waitForResponse((result) => result.url().endsWith("/save"));
    await save.click();
    await saved;
    await page.reload();
    await price.waitFor();
    expect(await name.inputValue()).toBe("Newer unsaved name");
    expect(await price.inputValue()).toBe("23.45");
    expect(fixture.saved.at(-1)).toEqual({
        name: "Newer unsaved name",
        mode: "advanced",
        note: "Keep this draft",
        decimals: true,
        price: 2345,
    });
}

async function frames(page: Page): Promise<void> {
    await page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
    );
}
