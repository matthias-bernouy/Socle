import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { bundle } from "../../navigation/definition";

test("page picker participates in native forms, required validation, reset and disabled fieldsets", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.route("http://cms.test/**", async (route) => {
            if (route.request().resourceType() === "document") {
                await route.fulfill({
                    contentType: "text/html",
                    body: '<!doctype html><form id="publication"><fieldset><cms-editor-v2-page-link name="page" label="Published page" required value="/terms" allow-external="false" allow-media="false"></cms-editor-v2-page-link></fieldset></form><script src="/control.js"></script>',
                });
            } else if (route.request().url().endsWith("/control.js")) {
                await route.fulfill({ contentType: "text/javascript", body: bundle });
            } else {
                await route.fulfill({
                    json: [
                        { path: "/terms", title: "Terms" },
                        { path: "/privacy", title: "Privacy" },
                    ],
                });
            }
        });
        await page.goto("http://cms.test/form");
        const picker = page.locator("cms-editor-v2-page-link");
        await picker.getByPlaceholder("Search pages").click();
        await picker.getByRole("button", { name: "Privacy /privacy", exact: true }).click();
        expect(await page.locator("form").evaluate((form) => new FormData(form as HTMLFormElement).get("page"))).toBe(
            "/privacy",
        );
        await page.locator("form").evaluate((form) => (form as HTMLFormElement).reset());
        expect(await picker.evaluate((element) => (element as HTMLElement & { value: string }).value)).toBe("/terms");
        expect(
            await picker.evaluate((element) => {
                (element as HTMLElement & { value: string }).value = "";
                return element.closest("form")!.checkValidity();
            }),
        ).toBe(false);
        await page.locator("fieldset").evaluate((element) => ((element as HTMLFieldSetElement).disabled = true));
        expect(await page.locator("form").evaluate((form) => new FormData(form as HTMLFormElement).has("page"))).toBe(
            false,
        );
        expect(await page.locator("form").evaluate((form) => (form as HTMLFormElement).checkValidity())).toBe(true);
    } finally {
        await browser.close();
    }
}, 15000);
