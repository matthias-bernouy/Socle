import type { Page } from "playwright";

const group = {
    source: { id: "fields", urn: "urn:fields", name: "Fields", endpointCount: 4, dashboardCount: 1, readonly: false },
    endpoints: [
        { endpointId: "list", method: "GET", params: [] },
        { endpointId: "get", method: "GET", params: [] },
        { endpointId: "reorder", method: "PUT", params: [] },
        { endpointId: "clear", method: "DELETE", params: [] },
    ],
    dashboards: [
        {
            id: "fields",
            source: "fields",
            meta: { name: "Personal information fields" },
            views: [
                {
                    widget: "w-navigation-list",
                    id: "fields",
                    title: "Fields",
                    source: { endpoint: "list", itemsPath: "items" },
                    rowKey: "id",
                    item: { title: { path: "label" }, subtitle: { path: "id" }, badge: { path: "type" }, icon: "tag" },
                    selection: { opens: "detail" },
                    reorderable: { action: "reorder" },
                    actions: [
                        { id: "add", label: "Add field", selection: { opens: "detail" } },
                        {
                            id: "clear",
                            label: "Clear fields",
                            tone: "danger",
                            confirm: "Clear all test fields?",
                            endpoint: { endpoint: "clear" },
                        },
                        { id: "reorder", label: "Reorder", endpoint: { endpoint: "reorder", body: { ids: "$value" } } },
                    ],
                },
                {
                    widget: "w-detail",
                    id: "detail",
                    source: { endpoint: "get", params: { id: "$selection.id" } },
                    title: { path: "label", fallback: "New field" },
                    main: [
                        {
                            id: "general",
                            title: "General",
                            fields: [{ id: "label", label: "Label", path: "label", type: "text" }],
                        },
                    ],
                },
            ],
        },
    ],
};

export async function installNavigationRoutes(page: Page, bundle: string, styles: string) {
    let items = ["Agency", "Club", "Region"].map((label) => ({ id: label.toLowerCase(), label, type: "string" }));
    const orders: string[][] = [];
    let clears = 0;
    let reads = 0;
    let release = () => {};
    let pending: Promise<void> | undefined;
    await page.route("http://cms.test/**", async (route) => {
        const url = new URL(route.request().url());
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
        } else if (url.pathname.endsWith("/list")) {
            reads += 1;
            await route.fulfill({ json: { items } });
        } else if (url.pathname.endsWith("/get")) {
            await route.fulfill({ json: items.find((item) => item.id === url.searchParams.get("id")) ?? {} });
        } else if (url.pathname.endsWith("/reorder")) {
            const { ids } = route.request().postDataJSON();
            orders.push(ids);
            if (pending) {
                await pending;
            }
            items = ids.map((id: string) => items.find((item) => item.id === id)!);
            await route.fulfill({ json: { ok: true } });
        } else if (url.pathname.endsWith("/clear")) {
            clears += 1;
            items = [];
            await route.fulfill({ json: { ok: true } });
        } else {
            await route.fulfill({ json: [] });
        }
    });
    return {
        orders,
        counts: () => ({ clears, reads }),
        hold: () => {
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
        },
        release: () => release(),
    };
}
