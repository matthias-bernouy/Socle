import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountShell } from "./fixture";

test("money controls submit minor units through native and bound forms without a detail widget", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ locale: "fr-FR" });
        page.setDefaultTimeout(5000);
        const writes: unknown[] = [];
        const errors = await mountShell(
            page,
            `<form id="save" cms-source="/save" cms-source-method="POST" cms-source-trigger="submit" cms-source-inherit-query="false" cms-source-serialization="typed-json" cms-source-success-reset="false">
            <p9r-money-input name="eur" label="Euro" currency="EUR" value="1250" required cms-form-value-type="number"></p9r-money-input>
            <p9r-money-input name="jpy" label="Yen" currency="JPY" value="150" cms-form-value-type="number"></p9r-money-input>
            <p9r-money-input name="kwd" label="Dinar" currency="KWD" value="1234" cms-form-value-type="number"></p9r-money-input>
            <p9r-money-input name="whole" label="Whole" currency="EUR" allow-decimals="false" value="2000" cms-form-value-type="number"></p9r-money-input>
            <p9r-money-input name="optional" label="Optional" cms-form-empty="null" cms-form-value-type="number"></p9r-money-input>
            <fieldset disabled><p9r-money-input name="disabled" label="Disabled" value="100"></p9r-money-input></fieldset>
            <button type="submit">Save</button><button type="reset">Reset</button>
        </form>`,
            async (route) => {
                writes.push(route.request().postDataJSON());
                await route.fulfill({ status: 204 });
            },
        );
        const eur = page.locator('[name="eur"] input');
        expect(await eur.inputValue()).toBe("12,50");
        expect(await page.getByRole("textbox", { name: "Dinar" }).inputValue()).toBe("1,234");
        expect(await page.getByRole("textbox", { name: "Disabled" }).isDisabled()).toBe(true);
        await eur.fill("18,75");
        expect(
            await page.locator("form").evaluate((form) =>
                (() => {
                    const values: Record<string, unknown> = {};
                    new FormData(form as HTMLFormElement).forEach((value, key) => {
                        values[key] = value;
                    });
                    return values;
                })(),
            ),
        ).toEqual({ eur: "1875", jpy: "150", kwd: "1234", whole: "2000", optional: "" });
        await page.getByRole("textbox", { name: "Whole", exact: true }).fill("1,50");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        expect(writes).toEqual([]);
        expect(await page.locator('[name="whole"]').evaluate((el: any) => el.validationMessage)).toContain(
            "without decimals",
        );
        await page.getByRole("textbox", { name: "Whole", exact: true }).fill("0");
        await eur.fill("1,");
        const node = await eur.elementHandle();
        await page.locator('[name="eur"]').evaluate((el: any) => {
            el.value = el.value;
        });
        expect(await eur.inputValue()).toBe("1,");
        await eur.fill("18.75");
        const response = page.waitForResponse("**/save");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await response;
        expect(writes).toEqual([{ eur: 1875, jpy: 150, kwd: 1234, whole: 0, optional: null }]);
        expect(await node!.evaluate((el) => el.isConnected)).toBe(true);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        expect(await eur.inputValue()).toBe("12,50");
        await eur.fill("");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        expect(writes).toHaveLength(1);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 20000);
