import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installDashboardRoutes } from "./fixture";

const bundle = resolve(import.meta.dir, "../../../../src/static/assets/control-components.js");
const staticRoot = resolve(import.meta.dir, "../../../../src/static/dashboards");

test("a denied session cannot mount a runtime and a runtime error leaves the operator profile available", async () => {
    const browser = await chromium.launch();
    try {
        for (const profile of [false, true]) {
            const page = await browser.newPage();
            page.setDefaultTimeout(5000);
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const fixture = await installDashboardRoutes(page);
            await page.route(profile ? "**/api/dashboard-session/dashboard?**" : "**/api/dashboard-session", (route) =>
                route.fulfill({ status: 403, body: "Forbidden" }),
            );
            await page.goto(`http://cms.test/dashboards${profile ? "/profile" : ""}?id=support`);
            await page.addScriptTag({ path: bundle });
            await page.evaluate(
                (html) => {
                    document.body.innerHTML = `<cms-binding-core>${html}</cms-binding-core>`;
                },
                (await Bun.file(`${staticRoot}/${profile ? "profile" : "index"}.html`).text()).replaceAll(
                    "{{BASE_PATH}}",
                    "",
                ),
            );
            if (profile) {
                await page.locator("cms-dashboard-workspace [data-profile]:not([hidden])").waitFor();
                expect(await page.locator("cms-dashboard-workspace").textContent()).toContain("support@example.com");
            } else {
                await page.locator("cms-dashboard-workspace [data-message][data-error]").waitFor();
                expect(await page.locator("[data-message]").textContent()).toContain("403");
                expect(fixture.requests.filter(({ path }) => path.includes("/dashboard-session/dashboard"))).toEqual(
                    [],
                );
            }
            expect(await page.evaluate(() => document.documentElement.dataset.dashboardScope)).toBeUndefined();
            expect(errors).toEqual([]);
            await page.close();
        }
    } finally {
        await browser.close();
    }
}, 15_000);
