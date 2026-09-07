import { expect, test } from "bun:test";
import { chromium, type Locator } from "playwright";
import { mkdir } from "node:fs/promises";
import { bundlePath, groups, installNavigation } from "./fixture";

function position(item: Locator) {
    return item.evaluate((node) => {
        const scrolls: [string, number, number][] = [];
        for (
            let parent: Element | null = node;
            parent;
            parent = parent.assignedSlot ?? parent.parentElement ?? (parent.getRootNode() as ShadowRoot).host ?? null
        ) {
            scrolls.push([parent.localName, parent.scrollTop, parent.scrollLeft]);
        }
        const rect = node.getBoundingClientRect();
        return {
            scrolls,
            rect: [rect.x, rect.y, rect.width, rect.height],
            focus: node.matches(":focus"),
            window: [scrollX, scrollY],
        };
    });
}

test("refreshing a long source navigation keeps the bottom link and both sidebars in place", async () => {
    const browser = await chromium.launch();
    let release: (() => void) | undefined;
    const captures = process.env.CMS_NAV_STABILITY_CAPTURES;
    if (captures) {
        await mkdir(captures, { recursive: true });
    }
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
            page.setDefaultTimeout(5000);
            const fixture = await installNavigation(page, await Bun.file(bundlePath).text());
            fixture.setGroups(
                Array.from({ length: 40 }, (_, index) => ({
                    ...structuredClone(groups[0]!),
                    source: { ...groups[0]!.source, id: `source-${index}`, name: `Source ${index}` },
                    dashboards: [],
                })),
            );
            await page.goto("http://cms.test/admin/sources?source=source-0");
            const last = page.locator('cms-dashboards-nav [data-source="source-39"]');
            await last.waitFor({ state: "attached" });
            if (width === 390) {
                await page.getByRole("button", { name: "Section", exact: true }).click();
            }
            await last.scrollIntoViewIfNeeded();
            await last.focus();
            const before = await position(last);
            expect(before.focus).toBe(true);
            expect(before.scrolls.some(([, top]) => top > 0)).toBe(true);
            const nav = page.locator("cms-dashboards-nav");
            const bounds = await nav.boundingBox();
            const original = await last.elementHandle();
            release = fixture.holdRead();
            const request = page.waitForRequest((entry) => entry.url().endsWith("/api/dashboards"));
            await page.evaluate(() => document.dispatchEvent(new Event("dashboard:definitions-changed")));
            await request;
            expect(await position(last)).toEqual(before);
            if (captures) {
                await page.screenshot({ path: `${captures}/${width}-pending.png`, animations: "disabled" });
            }
            const response = page.waitForResponse((entry) => entry.url().endsWith("/api/dashboards"));
            release();
            await response;
            for (let frame = 0; frame < 5; frame += 1) {
                await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
                expect(await position(last)).toEqual(before);
                expect(await nav.boundingBox()).toEqual(bounds);
            }
            expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
            if (captures) {
                await page.screenshot({ path: `${captures}/${width}-refreshed.png`, animations: "disabled" });
            }
            await page.close();
        }
    } finally {
        release?.();
        await browser.close();
    }
}, 30000);
