import type { Page } from "playwright";
import type { DashboardAction, DashboardField } from "@bernouy/cms-dashboards";
const resource = {
    title: "Product summary",
    text: "A description",
    list: ["First", "Second"],
    empty: [],
    date: "2026-09-07",
    amount: 1299,
    currency: "EUR",
    badge: "Available",
    image: "/example.svg",
};
const fields = [
    { id: "title", label: "Title", path: "title", type: "text" },
    ...["text", "list", "empty", "date", "amount", "badge", "image"].map((id) => ({
        id,
        label: id,
        path: id,
        type: "readonly",
        ...(["date", "badge", "image"].includes(id) ? { format: id } : id === "amount" ? { format: "money" } : {}),
    })),
];
const group = {
    source: { id: "store", urn: "urn:store", name: "Store", endpointCount: 1, dashboardCount: 1, readonly: false },
    endpoints: [{ endpointId: "item", method: "GET", params: [] }],
    dashboards: [
        {
            id: "summary",
            source: "store",
            meta: { name: "Summary" },
            views: [
                {
                    widget: "w-detail",
                    id: "detail",
                    source: { endpoint: "item" },
                    title: { path: "title", fallback: "Product" },
                    main: [{ id: "general", title: "General", fields }],
                },
            ],
        },
    ],
};

export async function installReadonlyRoutes(
    page: Page,
    script: string,
    styles: string,
    choices?: {
        fields: DashboardField[];
        extraEndpoints?: Array<{ endpointId: string; method: string; params: never[] }>;
        actions?: DashboardAction[];
        resource: Record<string, unknown>;
        normalize?: (resource: Record<string, unknown>) => Record<string, unknown>;
    },
) {
    const requests: string[] = [];
    const saved: Record<string, unknown>[] = [];
    let current: Record<string, unknown> = choices?.resource ?? resource;
    const definition = choices
        ? {
              ...group,
              endpoints: [
                  ...group.endpoints,
                  { endpointId: "save", method: "PUT", params: [] },
                  ...(choices.extraEndpoints ?? []),
              ],
              dashboards: group.dashboards.map((dashboard) => ({
                  ...dashboard,
                  views: dashboard.views.map((view) => ({
                      ...view,
                      actions: [
                          {
                              id: "save",
                              label: "Save choices",
                              endpoint: {
                                  endpoint: "save",
                                  body: Object.fromEntries(
                                      choices.fields
                                          .filter((field) => field.type !== "readonly")
                                          .map((field) => [field.id, `$field.${field.id}`]),
                                  ),
                              },
                              after: { resource: "$result" },
                          },
                          ...(choices.actions ?? []),
                      ],
                      main: [{ id: "general", title: "General", fields: choices.fields }],
                  })),
              })),
          }
        : group;
    let pending: Promise<void> | undefined;
    let pendingSave: Promise<void> | undefined;
    let failNextRead = false;
    await page.route("http://cms.test/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        requests.push(path);
        if (path === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: script });
        } else if (path === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (route.request().resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core></body>',
            });
        } else if (path === "/api/dashboards") {
            await route.fulfill({ json: [definition] });
        } else if (path.endsWith("/item")) {
            if (pending) {
                await pending;
            }
            if (failNextRead) {
                failNextRead = false;
                await route.fulfill({ status: 503, json: { error: "Temporary test failure" } });
            } else {
                await route.fulfill({ json: current });
            }
        } else if (path.endsWith("/save")) {
            const body = route.request().postDataJSON();
            saved.push(body);
            if (pendingSave) {
                await pendingSave;
            }
            current = { ...current, ...body };
            current = choices?.normalize?.(current) ?? current;
            await route.fulfill({ json: current });
        } else if (path === "/example.svg") {
            await route.fulfill({
                contentType: "image/svg+xml",
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#48766a"/></svg>',
            });
        } else {
            await route.fulfill({ json: [] });
        }
    });

    return {
        requests,
        saved,
        failRead() {
            failNextRead = true;
        },
        holdSave() {
            let release = () => {};
            pendingSave = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
        hold() {
            let release = () => {};
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
