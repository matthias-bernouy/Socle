import type { Page } from "playwright";
import { definitions, objects, resourceFor, root, setPath } from "./definitions";
const bundle = await Bun.file(`${root}/packages/surfaces/cms-control/src/static/assets/control-components.js`).text();
const styles = await Bun.file(`${root}/packages/foundation/components/dist/style.css`).text();

export async function integrationFixture(page: Page, entry: { widget: any; dashboard: any }, creation = false) {
    const { widget, dashboard } = JSON.parse(
        JSON.stringify(entry).replaceAll("{{dependencies.stripe.sourceId}}", "stripe-connect"),
    );
    const endpoints = [
        ...new Map(
            definitions
                .flatMap(({ definition }) => objects(definition).filter((n) => n.endpointId && n.method))
                .map((e) => [e.endpointId, e]),
        ).values(),
    ];
    const state = {
        resource: resourceFor(widget),
        reads: 0,
        writes: [] as Array<{ endpoint: string; body: any }>,
        errors: [] as string[],
        fail: false,
        pending: undefined as Promise<void> | undefined,
    };
    if (creation) {
        state.resource.id = null;
        state.resource.code = "";
        state.resource.key = "";
    }
    const operations = [widget.save, widget.delete, ...(widget.actions ?? []).map((a: any) => a.form)].filter(Boolean);
    page.on("pageerror", (error) => state.errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        const endpoint = path.split("/").at(-1)!;
        if (path === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (path === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (route.request().resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><head><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core></body>',
            });
        } else if (path === "/api/dashboards") {
            await route.fulfill({
                json: [
                    {
                        source: {
                            id: dashboard.source,
                            name: "Integration",
                            urn: `urn:${dashboard.source}`,
                            readonly: false,
                            endpointCount: endpoints.length,
                            dashboardCount: 1,
                        },
                        endpoints,
                        dashboards: [dashboard],
                    },
                    {
                        source: {
                            id: "stripe-connect",
                            name: "Stripe Connect",
                            urn: "urn:stripe-connect",
                            readonly: false,
                            endpointCount: endpoints.length,
                            dashboardCount: 0,
                        },
                        endpoints,
                        dashboards: [],
                    },
                ],
            });
        } else if (endpoint === widget.source.endpoint) {
            state.reads++;
            const body = widget.source.itemPath ? { [widget.source.itemPath]: state.resource } : state.resource;
            await route.fulfill({ json: body });
        } else if (operations.some((operation: any) => operation.endpoint === endpoint)) {
            const body = route.request().postDataJSON();
            state.writes.push({ endpoint, body });
            await state.pending;
            if (state.fail) {
                state.fail = false;
                await route.fulfill({ status: 409, json: { error: "Conflict: reload the latest revision" } });
            } else {
                state.resource.version++;
                if (creation && !state.resource.id) {
                    const identity = widget.save?.hiddenFields?.find((field: any) => field.value === "$resource.id");
                    state.resource.id = identity?.type === "number" ? 43 : "created-resource";
                }
                if (endpoint === widget.save?.endpoint) {
                    for (const field of [...widget.main, ...(widget.aside ?? [])].flatMap((s: any) => s.fields ?? [])) {
                        const name = field.name ?? field.path;
                        if (Object.hasOwn(body, name)) {
                            setPath(state.resource, field.path, body[name]);
                        }
                    }
                }
                await route.fulfill({
                    json: widget.source.itemPath ? { [widget.source.itemPath]: state.resource } : state.resource,
                });
            }
        } else {
            await route.fulfill({ json: { items: [], fields: [] } });
        }
    });
    return {
        state,
        url: `http://cms.test/admin/sources?source=${dashboard.source}&dashboard=${dashboard.id}&collection=${widget.id}&row=${creation ? "__new__" : "42"}`,
    };
}
