import type { Page } from "playwright";
import { dashboard } from "./definition";
export async function installTableRoutes(page: Page, bundle: string, styles: string) {
    let items = ["Alpha", "Beta", "Gamma"].map((name, index) => ({
        id: String(index + 1),
        name,
        status: index === 1 ? "draft" : "active",
        price: 1200 + index * 100,
        currency: "EUR",
        updated: "2026-09-07",
    }));
    const reads: string[] = [];
    const writes: unknown[] = [];
    let clears = 0;
    const holds = new Map<string, Promise<void>>();
    const failures = new Set<string>();
    const group = {
        source: { id: "store", urn: "urn:store", name: "Store", endpointCount: 5, dashboardCount: 1, readonly: false },
        endpoints: ["items", "item", "save", "export", "clear"].map((endpointId) => ({
            endpointId,
            method: endpointId === "save" ? "PUT" : endpointId === "clear" ? "DELETE" : "GET",
            params: [],
        })),
        dashboards: [dashboard],
    };
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
        } else if (endpoint === "items") {
            const q = url.searchParams.get("q") ?? "";
            const status = url.searchParams.get("status");
            const result = items.filter(
                (item) => item.name.toLowerCase().includes(q.toLowerCase()) && (!status || item.status === status),
            );
            reads.push(url.pathname + url.search);
            const pending = holds.get(q);
            if (pending) {
                await pending;
            }
            if (failures.delete(q)) {
                await route.fulfill({ status: 503, json: { error: "Temporary catalogue failure" } });
            } else {
                await route.fulfill({ json: { items: result } });
            }
        } else if (endpoint === "item") {
            await route.fulfill({ json: items.find((item) => item.id === url.searchParams.get("id")) ?? {} });
        } else if (endpoint === "save") {
            const body = route.request().postDataJSON();
            writes.push(body);
            const id = body.id === "__new__" ? String(items.length + 1) : body.id;
            const resource = {
                id,
                name: String(body.name).trim(),
                status: "draft",
                price: 1200,
                currency: "EUR",
                updated: "2026-09-07",
            };
            items = items.some((item) => item.id === id)
                ? items.map((item) => (item.id === id ? { ...item, name: resource.name } : item))
                : [...items, resource];
            await route.fulfill({ json: items.find((item) => item.id === id) });
        } else if (endpoint === "export") {
            await route.fulfill({
                contentType: "text/csv",
                body: "id,name\n" + items.map((item) => `${item.id},${item.name}`).join("\n"),
            });
        } else if (endpoint === "clear") {
            clears += 1;
            items = [];
            await route.fulfill({ json: { ok: true } });
        } else {
            await route.fulfill({ json: [] });
        }
    });
    return {
        reads,
        writes,
        clears: () => clears,
        fail(query: string) {
            failures.add(query);
        },
        hold(query: string) {
            let release = () => {};
            holds.set(
                query,
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
            );
            return release;
        },
    };
}
