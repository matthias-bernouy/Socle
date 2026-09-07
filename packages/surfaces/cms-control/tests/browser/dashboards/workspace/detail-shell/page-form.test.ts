import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountShell, sourceRoot } from "./fixture";

test("the page header submits both body columns while independent actions stay separate", async () => {
    const browser = await chromium.launch();
    try {
        for (const width of [1440, 390]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const content = (await Bun.file(`${sourceRoot}/static/admin/_content/pages/detail.html`).text()).replaceAll(
                "{{BASE_PATH}}",
                "",
            );
            let resource = {
                id: "page-1",
                title: "Pricing",
                description: "Pricing page",
                path: "/pricing",
                publicUrl: "https://site.test/pricing",
                tags: ["pricing"],
                published: true,
                indexingEditor: { enabled: true, candidates: [], availableVariables: [], detectionStatus: "none" },
            };
            const writes: Record<string, unknown>[] = [];
            let fail = true;
            const errors = await mountShell(page, content, async (route, url) => {
                if (url.pathname === "/api/page/configDetail") {
                    if (route.request().method() === "PUT") {
                        const body = route.request().postDataJSON();
                        writes.push(body);
                        if (fail) {
                            await route.fulfill({
                                status: 422,
                                json: { field: "title", error: "Choose another title" },
                            });
                            return;
                        }
                        resource = { ...resource, ...body };
                    }
                    await route.fulfill({ json: resource });
                } else if (url.pathname === "/api/page/exists") {
                    await route.fulfill({ json: { exists: false } });
                } else {
                    await route.fulfill({ json: [] });
                }
            });
            const title = page.locator('p9r-input[name="title"] input');
            const path = page.locator('p9r-input[name="path"] input');
            await title.waitFor();
            const ownership = await page.evaluate(() => {
                const form = document.querySelector("#page-settings-form")!;
                return {
                    slot: form.getAttribute("slot"),
                    main: Boolean(form.querySelector('cms-shell-detail-body > [slot="main"]')),
                    aside: Boolean(form.querySelector('cms-shell-detail-body > [slot="aside"]')),
                    nested: Boolean(form.querySelector("form, cms-confirm-form")),
                    actions: document.querySelector('form[action="/editor/page"]')?.closest("#page-settings-form"),
                };
            });
            expect(ownership).toEqual({ slot: "body", main: true, aside: true, nested: false, actions: null });
            await title.fill("Plans");
            await path.fill("/plans");
            await page.getByRole("button", { name: "Save settings", exact: true }).click();
            await page.getByText("Choose another title", { exact: true }).waitFor();
            expect(writes).toHaveLength(1);
            expect(writes[0]).toMatchObject({ title: "Plans", path: "/plans", published: "true" });
            expect(await title.inputValue()).toBe("Plans");
            expect(await path.inputValue()).toBe("/plans");
            fail = false;
            await title.fill("Plans and pricing");
            const navigation = page.waitForEvent("load");
            await page.getByRole("button", { name: "Save settings", exact: true }).click();
            await navigation;
            await title.waitFor();
            expect(writes).toHaveLength(2);
            expect(await title.inputValue()).toBe("Plans and pricing");
            expect(await path.inputValue()).toBe("/plans");
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 30000);
