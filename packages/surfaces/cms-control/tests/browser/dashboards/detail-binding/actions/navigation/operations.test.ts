import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { formKey, mountForms, sectionRef, questionRef } from "./fixture";

test("Forms list creation and question deletion submit independent typed forms and read their destination", async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.setDefaultTimeout(6000);
    try {
        const { requests, errors } = await mountForms(page);
        await page.locator('[data-action="backToSection"]').click();
        await page.locator('[data-action="backToForm"]').click();
        const addSection = page.getByRole("button", { name: "Add section", exact: true });
        await addSection.waitFor();
        const title = page.locator('[data-field-control="title"] input');
        await title.fill("Unsaved title");
        await addSection.click();
        await page.getByText("Save or discard the current changes", { exact: false }).waitFor();
        expect(requests.filter((r) => r.method === "POST")).toHaveLength(0);
        await page.reload();
        await addSection.click();
        await page.locator('[data-action="backToForm"]').waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(sectionRef);
        await page.getByRole("button", { name: "Add question", exact: true }).click();
        await page.locator('[data-action="backToSection"]').waitFor();
        expect(new URL(page.url()).searchParams.get("row")).toBe(questionRef);
        const deleting = page.getByRole("button", { name: "Delete question", exact: true });
        await deleting.click();
        const modal = page.locator("p9r-modal[open]");
        await modal.getByRole("button", { name: "Delete question", exact: true }).click();
        await page.locator('[data-action="backToForm"]').waitFor();
        expect(requests.filter((r) => r.method === "POST").map(({ endpoint, body }) => ({ endpoint, body }))).toEqual([
            { endpoint: "createSection", body: { context: formKey } },
            { endpoint: "createQuestion", body: { context: sectionRef } },
            { endpoint: "deleteQuestion", body: { ref: questionRef } },
        ]);
        expect(requests.filter((r) => r.endpoint === "manageQuestion")).toHaveLength(2);
        expect(errors).toEqual([]);
        await page.screenshot({ path: "/tmp/cmscore-forms-independent-actions.png", fullPage: true });
    } finally {
        await browser.close();
    }
}, 30000);
