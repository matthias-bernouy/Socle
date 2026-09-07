import type { Page } from "playwright";

export async function installConnectionRoutes(page: Page, bundle: string, styles: string) {
    const writes: Array<{ values: Record<string, unknown>; expectedRevision: string }> = [];
    const requests: string[] = [];
    let settings = {
        values: { country: "FR", mode: "test", enabled: false, notes: "Existing notes", metadata: { keep: true } },
        savedRevision: "v1",
        appliedRevision: "v1",
    };
    let failure = false;
    await page.route("http://cms.test/**", async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        requests.push(`${request.method()} ${path}`);
        if (path === "/control.js") {
            await route.fulfill({ contentType: "text/javascript", body: bundle });
        } else if (path === "/style.css") {
            await route.fulfill({ contentType: "text/css", body: styles });
        } else if (request.resourceType() === "document") {
            await route.fulfill({
                contentType: "text/html",
                body: '<!doctype html><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><script src="/control.js"></script></head><body><cms-binding-core><w13c-fixed-admin-layout><cms-integration-management installation-id="service"></cms-integration-management></w13c-fixed-admin-layout></cms-binding-core></body>',
            });
        } else if (path === "/api/integrations/installations") {
            await route.fulfill({
                json: {
                    id: "service",
                    label: "Service",
                    integrationType: "source",
                    status: "success",
                    definition: {
                        kind: "service",
                        label: "Service",
                        inputs: [],
                        management: {
                            schemaVersion: 1,
                            settings: {
                                readFunctionId: "read",
                                saveFunctionId: "save",
                                fields: [
                                    { id: "country", label: "Country", path: "country", type: "text", required: true },
                                    {
                                        id: "mode",
                                        label: "Mode",
                                        path: "mode",
                                        type: "select",
                                        options: [
                                            { value: "test", label: "Test" },
                                            { value: "live", label: "Live" },
                                        ],
                                    },
                                    { id: "enabled", label: "Enabled", path: "enabled", type: "checkbox" },
                                    { id: "notes", label: "Notes", path: "notes", type: "textarea" },
                                ],
                            },
                        },
                    },
                },
            });
        } else if (path === "/api/integrations/management/settings") {
            if (request.method() === "POST") {
                const body = request.postDataJSON();
                writes.push(body);
                if (failure) {
                    failure = false;
                    await route.fulfill({ status: 503, json: { error: "Please retry this save." } });
                    return;
                }
                if (body.expectedRevision !== settings.savedRevision) {
                    await route.fulfill({ status: 409, json: { error: "Revision conflict" } });
                    return;
                }
                settings = {
                    values: { ...body.values, country: body.values.country.trim().toUpperCase() },
                    savedRevision: `v${writes.length + 1}`,
                    appliedRevision: `v${writes.length + 1}`,
                };
            }
            await route.fulfill({ json: settings });
        } else if (path === "/api/integrations/management/health") {
            await route.fulfill({
                json: {
                    schemaVersion: 1,
                    installationId: "service",
                    observedAt: "2026-09-07T12:00:00Z",
                    freshness: "unavailable",
                    observation: "unsupported",
                    report: null,
                },
            });
        } else {
            await route.fulfill({ json: [] });
        }
    });
    return {
        writes,
        requests,
        failSave: () => {
            failure = true;
        },
        settings: () => settings,
    };
}
