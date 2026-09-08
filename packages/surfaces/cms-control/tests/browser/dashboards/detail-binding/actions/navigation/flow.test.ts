import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { formKey, mountForms, questionRef, sectionRef } from "./fixture";
test("official Forms returns read each parent once, preserve identities and protect unsaved section input", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.setDefaultTimeout(5000);
    try {
        const { requests, errors } = await mountForms(page);
        await page.locator('[data-action="backToSection"]').click();
        const title = page.locator('[data-field-control="title"] input');
        await title.waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(sectionRef);
        expect(requests.filter((request) => request.endpoint === "manageSection")).toEqual([
            { method: "GET", endpoint: "manageSection", params: { ref: sectionRef } },
        ]);
        await title.fill("Unsaved section title");
        const beforeCancel = requests.length;
        page.once("dialog", (dialog) => dialog.dismiss());
        await page.locator('[data-action="backToForm"]').click();
        expect(new URL(page.url()).searchParams.get("row")).toBe(sectionRef);
        expect(await title.inputValue()).toBe("Unsaved section title");
        expect(requests).toHaveLength(beforeCancel);
        page.once("dialog", (dialog) => dialog.accept());
        await page.locator('[data-action="backToForm"]').click();
        await page.locator('cms-dashboard-w-navigation-item[collection="sectionDetail"]').waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(formKey);
        expect(requests.filter((request) => request.endpoint === "manageForm")).toEqual([
            { method: "GET", endpoint: "manageForm", params: { key: formKey } },
        ]);
        await page.locator('cms-dashboard-w-navigation-item[collection="sectionDetail"]').click();
        await title.waitFor();
        expect(await title.inputValue()).toBe("Section title");
        expect(requests.every((request) => request.method === "GET")).toBe(true);
        expect(await page.getByText(/backTo(Form|Section) completed/).count()).toBe(0);
        expect(errors).toEqual([]);
        await page.screenshot({ path: "/tmp/cmscore-forms-navigation-desktop.png", fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: "/tmp/cmscore-forms-navigation-mobile.png", fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
        await browser.close();
    }
}, 30000);

test("missing parent identity cannot navigate or make another source request", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    try {
        const { requests, errors } = await mountForms(page, true);
        const before = requests.length;
        await page.locator('[data-action="backToSection"]').click();
        await page.getByText("The navigation target is unavailable.", { exact: false }).waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(questionRef);
        expect(requests).toHaveLength(before);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);

test("a failed parent read retries only the destination GET", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    try {
        const { requests, errors, failNextSection } = await mountForms(page);
        failNextSection();
        await page.locator('[data-action="backToSection"]').click();
        await page.getByText("Unable to load this data", { exact: false }).waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(sectionRef);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await page.locator('[data-action="backToForm"]').waitFor();
        expect(requests.filter((request) => request.endpoint === "manageSection")).toHaveLength(2);
        expect(requests.filter((request) => request.endpoint === "manageQuestion")).toHaveLength(1);
        expect(requests.every((request) => request.method === "GET")).toBe(true);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 15000);
