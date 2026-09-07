import { resolve } from "node:path";
import type { Page, Route } from "playwright";

export const sourceRoot = resolve(import.meta.dir, "../../../../../src");
const script = await Bun.file(`${sourceRoot}/static/assets/control-components.js`).text();
const styles = await Bun.file(
    resolve(import.meta.dir, "../../../../../../../foundation/components/dist/style.css"),
).text();

export async function mountShell(
    page: Page,
    content: string,
    handle: (route: Route, url: URL) => Promise<void> = async (route) => route.fulfill({ json: [] }),
): Promise<string[]> {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const url = new URL(route.request().url());
        if (route.request().resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: `<!doctype html><meta name="basePath" content=""><style>${styles}</style>
                    <cms-binding-core>${content}</cms-binding-core><script src="/assets/control-components.js"></script>`,
            });
        } else if (url.pathname === "/assets/control-components.js") {
            await route.fulfill({ contentType: "text/javascript", body: script });
        } else {
            await handle(route, url);
        }
    });
    await page.goto("http://cms.test/admin/pages/detail?id=page-1");
    await page.waitForFunction(() => customElements.get("cms-shell-detail-body") !== undefined);
    return errors;
}
