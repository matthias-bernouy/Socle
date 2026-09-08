import type { Page } from "playwright";
import { dashboard } from "./nested-definition";

export async function installNestedRoutes(page: Page, bundle: string, styles: string, sharedForm = false) {
    const definition = structuredClone(dashboard);
    if (sharedForm) {
        const parent = (definition.views[0] as any).children[0].tabs[0].children[0];
        parent.save = { endpoint: "saveParent", label: "Save section" };
        parent.actions = [];
        const list = parent.main.find((section: any) => section.widget === "w-navigation-list");
        const reorder = list.actions.find((action: any) => action.id === "reorder");
        delete reorder.endpoint;
        reorder.form = { endpoint: "reorder" };
    }
    let resource = { name: "Introduction", note: "A note" };
    let items = ["First", "Second", "Third"].map((name, index) => ({ id: `question-${index + 1}`, name }));
    const writes: { endpoint: string; body: unknown }[] = [];
    const reads: string[] = [];
    const group = {
        source: { id: "forms", urn: "urn:forms", name: "Forms", readonly: false, endpointCount: 8, dashboardCount: 1 },
        endpoints: ["parent", "children", "child", "info", "saveParent", "saveChild", "reorder", "clear"].map(
            (endpointId) => ({
                endpointId,
                method: ["parent", "children", "child", "info"].includes(endpointId) ? "GET" : "PUT",
                params: [],
            }),
        ),
        dashboards: [definition],
    };
    let pending: Promise<void> | undefined;
    let failChildren = false;
    await page.route("http://cms.test/**", async (route) => {
        const url = new URL(route.request().url());
        const endpoint = url.pathname.split("/").at(-1)!;
        if (url.pathname === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (url.pathname === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (route.request().resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core></body>',
            });
        } else if (url.pathname === "/api/dashboards") {
            await route.fulfill({ json: [group] });
        } else if (["parent", "children", "child", "info"].includes(endpoint)) {
            reads.push(url.pathname + url.search);
            if (endpoint === "children" && failChildren) {
                failChildren = false;
                await route.fulfill({ status: 503, json: { error: "Temporary questions failure" } });
                return;
            }
            if (endpoint === "parent" && pending) {
                await pending;
            }
            await route.fulfill({
                json:
                    endpoint === "parent"
                        ? resource
                        : endpoint === "children"
                          ? { items }
                          : endpoint === "info"
                            ? { text: "Nested information" }
                            : items.find((item) => item.id === url.searchParams.get("id")),
            });
        } else if (["saveParent", "saveChild", "reorder", "clear"].includes(endpoint)) {
            const body = route.request().postData() ? route.request().postDataJSON() : {};
            writes.push({ endpoint, body });
            if (endpoint === "saveParent") {
                resource = { name: String(body.name).trim(), note: body.note };
            } else if (endpoint === "saveChild") {
                items = items.map((item) => (item.id === body.id ? { ...item, name: String(body.name).trim() } : item));
            } else if (endpoint === "reorder") {
                items = body.ids.map((id: string) => items.find((item) => item.id === id)!);
            } else {
                items = [];
            }
            await route.fulfill({
                json:
                    endpoint === "saveParent"
                        ? resource
                        : endpoint === "saveChild"
                          ? items.find((item) => item.id === body.id)
                          : { ok: true },
            });
        } else {
            await route.fulfill({ json: [] });
        }
    });
    return {
        reads,
        writes,
        failChildren() {
            failChildren = true;
        },
        holdParent() {
            let release = () => {};
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
