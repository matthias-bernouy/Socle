import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountForms, sectionRef, questionRef, formKey } from "./fixture";

test("Forms reorders sections and questions with an independent native form and stable parent controls", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
        page.setDefaultTimeout(5000);
        const fixture = await mountForms(page, false, true);
        for (const entry of [
            {
                back: "backToSection",
                view: "sectionDetail",
                list: "questionNavigation",
                endpoint: "reorderQuestions",
                read: "manageQuestions",
                context: sectionRef,
                refs: ["other-question", questionRef],
            },
            {
                back: "backToForm",
                view: "formDetail",
                list: "sectionNavigation",
                endpoint: "reorderSections",
                read: "manageSections",
                context: formKey,
                refs: ["other-section", sectionRef],
            },
        ]) {
            await page.locator(`[data-action="${entry.back}"]`).click();
            const host = page.locator(`cms-dashboard-w-detail[data-widget-id="${entry.view}"]`);
            const input = host.locator('[data-field-control="title"] input');
            await input.waitFor();
            const node = await input.elementHandle();
            const before = await input.boundingBox();
            const list = host.locator(`cms-dashboard-w-navigation-list[data-widget-id="${entry.list}"]`);
            const rows = list.locator("cms-dashboard-w-navigation-item");
            const read = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith(`/${entry.read}`));
            await rows.first().locator("[data-handle]").dragTo(rows.last());
            await read;
            await page.waitForFunction(
                () => !document.querySelector('cms-dashboard-w-navigation-list[aria-busy="true"]'),
            );
            expect(fixture.requests.filter((r) => r.method !== "GET").at(-1)).toMatchObject({
                endpoint: entry.endpoint,
                body: { context: entry.context, refs: entry.refs },
            });
            expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
            expect(await input.boundingBox()).toEqual(before);
            expect(await page.locator("form form").count()).toBe(0);
            await page.screenshot({ path: `/tmp/cmscore-forms-${entry.endpoint}.png` });
        }
        expect(fixture.errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 30000);
