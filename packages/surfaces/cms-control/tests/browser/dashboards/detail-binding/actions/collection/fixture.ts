import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveIntegrationDefinitionFile } from "@bernouy/cms-integrations/fs";
import type { DashboardDto, DashboardWidget } from "@bernouy/cms-dashboards";
import type { Page } from "playwright";
import { bundle, styles } from "../navigation/definition";

const root = dirname(
    fileURLToPath(import.meta.resolve("@bernouy/cms-official-integrations/integrations/mondial-relay/definition.json")),
);
const definition = (await resolveIntegrationDefinitionFile(`${root}/definition.json`, root)) as {
    artifacts: Array<{ type: string; view?: DashboardDto; source?: { endpoints: unknown[] } }>;
};
function find(views: DashboardWidget[]): DashboardWidget | undefined {
    for (const view of views) {
        if (view.id === "projectionExceptionsTable") {
            return view;
        }
        const child =
            view.widget === "w-section"
                ? find(view.children)
                : view.widget === "w-tabs"
                  ? find(view.tabs.flatMap((t) => t.children))
                  : undefined;
        if (child) {
            return child;
        }
    }
}
const original = definition.artifacts.find((a) => a.view && find(a.view.views))!.view!;
const dashboard = { ...original, views: [find(original.views)!] };
const source = definition.artifacts.find((a) => a.type === "source")!.source!;

export async function mountCollection(page: Page) {
    const writes: unknown[] = [];
    const errors: string[] = [];
    const state = { reads: 0, failWrite: false, failRead: false };
    const items = ["event-1", "event-2"].map((id) => ({
        id,
        projectionStatus: "manual_review",
        externalOrderId: id,
        projectionAttempts: 3,
    }));
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core><script src="/control.js"></script>',
            });
        } else if (path === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (path === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (path === "/api/dashboards") {
            await route.fulfill({
                json: [
                    {
                        source: {
                            id: dashboard.source,
                            name: "Delivery",
                            urn: `urn:${dashboard.source}`,
                            dashboardCount: 1,
                            endpointCount: source.endpoints.length,
                        },
                        dashboards: [dashboard],
                        endpoints: source.endpoints,
                    },
                ],
            });
        } else if (path.endsWith("/shipmentProjectionExceptions")) {
            state.reads++;
            await route.fulfill(
                state.failRead ? { status: 503, json: { error: "Read unavailable" } } : { json: { items } },
            );
        } else if (path.endsWith("/reviewShipmentProjectionException")) {
            writes.push(request.postDataJSON());
            await route.fulfill(
                state.failWrite ? { status: 409, json: { error: "Retry unavailable" } } : { json: { ok: true } },
            );
        } else {
            await route.fulfill({ json: [] });
        }
    });
    await page.goto(`http://cms.test/admin/sources?source=${dashboard.source}&dashboard=${dashboard.id}`);
    await page.locator('cms-dashboard-w-row[row-key="event-1"]').waitFor();
    return { writes, errors, state };
}
