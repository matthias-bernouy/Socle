import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { installNestedRoutes } from "./nested-fixture";
import { checkNestedStability } from "./nested-stability";

const bundle = await Bun.file(resolve(import.meta.dir, "../../../../src/static/assets/control-components.js")).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../foundation/components/dist/style.css"),
).text();

test("nested detail navigation saves, retries and handles child actions once without losing parent drafts", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1200, height: 650 }, reducedMotion: "reduce" });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const fixture = await installNestedRoutes(page, bundle, styles);
        const releaseInitial = fixture.holdParent();
        const childrenRequested = page.waitForRequest((request) => request.url().endsWith("/children"));
        await page.goto("http://cms.test/admin/sources?source=forms&dashboard=forms");
        await childrenRequested;
        const parent = page.locator('cms-dashboard-w-detail[data-widget-id="parent"]');
        const list = parent.locator("cms-dashboard-w-navigation-list");
        const rows = list.locator("cms-dashboard-w-navigation-item");
        const name = parent.locator('[data-field-control="name"] input');
        expect(await list.isVisible()).toBe(false);
        expect(await name.count()).toBe(0);
        releaseInitial();
        await rows.last().waitFor();
        await name.waitFor();
        expect(await parent.getAttribute("data-declarative")).not.toBeNull();
        expect(await parent.locator("cms-dashboard-input").count()).toBe(0);
        expect(await name.evaluate((node) => (node.getRootNode() as ShadowRoot).host.getRootNode() === document)).toBe(
            true,
        );
        await name.fill("");
        let dialogs = 0;
        page.once("dialog", async (dialog) => {
            dialogs += 1;
            await dialog.dismiss();
        });
        await list.getByRole("button", { name: "Clear questions", exact: true }).click();
        expect(dialogs).toBe(1);
        expect(fixture.writes).toHaveLength(0);
        await name.fill("  Edited section  ");
        await page.getByRole("tab", { name: "Information", exact: true }).click();
        await page.getByText("Nested information", { exact: true }).waitFor();
        await page.getByRole("tab", { name: "Edit", exact: true }).click();
        expect(await name.inputValue()).toBe("  Edited section  ");
        expect(fixture.reads.filter((path) => path.endsWith("/children"))).toHaveLength(1);
        const saved = page.waitForResponse((response) => response.url().endsWith("/saveParent"));
        await parent.getByRole("button", { name: "Save section", exact: true }).click();
        await saved;
        expect(fixture.writes.filter((write) => write.endpoint === "saveParent")).toEqual([
            { endpoint: "saveParent", body: { name: "  Edited section  ", note: "A note" } },
        ]);
        await page.waitForFunction(
            () =>
                document.querySelector('[data-field-control="name"]')?.shadowRoot?.querySelector("input")?.value ===
                "Edited section",
        );
        expect(fixture.reads.filter((path) => path.endsWith("/children"))).toHaveLength(1);
        await page.reload();
        await rows.last().waitFor();
        expect(await name.inputValue()).toBe("Edited section");
        await checkNestedStability(page, fixture);
        const reorder = page.waitForResponse((response) => response.url().endsWith("/reorder"));
        const reordered = page.waitForResponse((response) => response.url().endsWith("/children"));
        await rows.first().locator("[data-handle]").dragTo(rows.last());
        await reorder;
        await reordered;
        expect(fixture.writes.filter((write) => write.endpoint === "reorder")).toEqual([
            { endpoint: "reorder", body: { ids: ["question-2", "question-3", "question-1"] } },
        ]);
        await page.reload();
        await rows.last().waitFor();
        expect(await rows.first().getAttribute("row-key")).toBe("question-2");
        await rows.first().getByRole("button").click();
        const child = page.locator('cms-dashboard-w-detail[data-widget-id="child"]');
        await child.locator('[data-field-control="name"] input').fill("  Edited question  ");
        const childSaved = page.waitForResponse((response) => response.url().endsWith("/saveChild"));
        await child.getByRole("button", { name: "Save question", exact: true }).click();
        await childSaved;
        expect(fixture.writes.filter((write) => write.endpoint === "saveChild")).toEqual([
            { endpoint: "saveChild", body: { id: "question-2", name: "  Edited question  " } },
        ]);
        await page.reload();
        await child.locator('[data-field-control="name"] input').waitFor();
        expect(await child.locator('[data-field-control="name"] input').inputValue()).toBe("Edited question");
        await page.goBack();
        await rows.last().waitFor();
        expect(await rows.first().getAttribute("title")).toBe("Edited question");
        await page.goForward();
        await child.locator('[data-field-control="name"] input').waitFor();
        expect(await child.locator('[data-field-control="name"] input').inputValue()).toBe("Edited question");
        await child.getByRole("button", { name: "Back to table", exact: true }).click();
        await rows.last().waitFor();
        expect(await rows.first().getAttribute("title")).toBe("Edited question");
        await page.goto("http://cms.test/admin/sources?source=forms&dashboard=forms&collection=parent&row=section-1");
        await rows.last().waitFor();
        expect(fixture.reads.some((path) => path.endsWith("/children?context=section-1"))).toBe(true);
        page.once("dialog", async (dialog) => {
            dialogs += 1;
            await dialog.accept();
        });
        const cleared = page.waitForResponse((response) => response.url().endsWith("/clear"));
        await list.getByRole("button", { name: "Clear questions", exact: true }).click();
        await cleared;
        await list.getByText("No items.", { exact: true }).waitFor();
        expect(dialogs).toBe(2);
        expect(fixture.writes.filter((write) => write.endpoint === "clear")).toHaveLength(1);
        await page.reload();
        await list.getByText("No items.", { exact: true }).waitFor();
        expect(await rows.count()).toBe(0);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
}, 25_000);
