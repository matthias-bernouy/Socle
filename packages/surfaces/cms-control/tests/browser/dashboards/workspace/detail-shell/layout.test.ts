import { expect, test } from "bun:test";
import { chromium } from "playwright";
import { mountShell } from "./fixture";

test("detail bodies preserve columns, responsive stacking and the form's light DOM", async () => {
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage();
        const errors = await mountShell(
            page,
            `<cms-shell-detail>
                <span slot="title">Product</span>
                <p9r-button slot="actions" type="submit" form="save">Save</p9r-button>
                <form id="save" slot="body">
                    <cms-shell-detail-body>
                        <cms-detail-section slot="main" heading="Details">
                            <p9r-input name="title" label="Title" value="Racket"></p9r-input>
                        </cms-detail-section>
                        <cms-detail-section slot="aside" heading="State">
                            <p9r-input name="status" label="Status" value="draft"></p9r-input>
                        </cms-detail-section>
                    </cms-shell-detail-body>
                </form>
            </cms-shell-detail>`,
        );
        for (const width of [1440, 900, 880, 390]) {
            await page.setViewportSize({ width, height: 900 });
            const geometry = await page.evaluate(() => {
                const body = document.querySelector("cms-shell-detail-body")!;
                const main = body.querySelector('[slot="main"]')!.getBoundingClientRect();
                const aside = body.querySelector('[slot="aside"]')!.getBoundingClientRect();
                const form = document.querySelector("form")!;
                const values: Record<string, FormDataEntryValue> = {};
                new FormData(form).forEach((value, name) => {
                    values[name] = value;
                });
                return {
                    main: { x: main.x, y: main.y, width: main.width, bottom: main.bottom },
                    aside: { x: aside.x, y: aside.y, width: aside.width },
                    values,
                    sameRoot: body.getRootNode() === form.getRootNode(),
                    overflow: document.documentElement.scrollWidth > innerWidth,
                };
            });
            expect(geometry.sameRoot).toBe(true);
            expect(geometry.values).toEqual({ title: "Racket", status: "draft" });
            expect(geometry.overflow).toBe(false);
            if (width > 880) {
                expect(geometry.main.y).toBe(geometry.aside.y);
                expect(geometry.aside.x - geometry.main.x - geometry.main.width).toBeCloseTo(16, 1);
                if (width === 1440) {
                    expect(geometry.main.width).toBe(600);
                    expect(geometry.aside.width).toBe(285);
                }
            } else {
                expect(geometry.aside.y - geometry.main.bottom).toBeCloseTo(16, 1);
                expect(geometry.aside.width).toBe(geometry.main.width);
            }
        }
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.evaluate(() => {
            const shell = document.querySelector("cms-shell-detail") as HTMLElement;
            shell.style.setProperty("--w-detail-main-width", "940px");
            shell.style.setProperty("--w-detail-aside-width", "0px");
            shell.style.setProperty("--w-detail-gap", "0px");
            shell.querySelector('[slot="aside"]')!.remove();
        });
        expect((await page.locator('cms-detail-section[slot="main"]').boundingBox())?.width).toBe(940);
        expect(errors).toEqual([]);
    } finally {
        await browser.close();
    }
});
