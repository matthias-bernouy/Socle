import "../../Dashboards/view/DashboardView";
import { route, integrationRouteUrl } from "../api";
import type { IntegrationBrowserHost, IntegrationDefinition } from "../model";

export function renderDetail(host: IntegrationBrowserHost): void {
    const root = host.query<HTMLElement>("[data-detail-view]");
    const installation = host.installations.find((item) => item.id === host.selectedIntegrationId);
    if (!installation) {
        return;
    }
    const settings = installation.management?.settings;
    if (settings?.fields.length || settings?.dashboardId) {
        const view = document.createElement("cms-dashboards-admin");
        view.setAttribute("embedded", "");
        view.setAttribute("dashboard-id", settings.dashboardId ?? `integration-${installation.id}-settings`);
        root.replaceChildren(view);
    } else {
        const link = document.createElement("a");
        link.href = route("/admin/health");
        link.textContent = "View integration health";
        root.replaceChildren(link);
    }
}

export function renderLinkedResources(
    root: HTMLElement,
    host: IntegrationBrowserHost,
    definition?: IntegrationDefinition,
): void {
    const dependencies = definition?.dependencies ?? [];
    root.replaceChildren();
    for (const dependency of dependencies) {
        const installed = host.installations.find((item) => item.id === dependency.kind);
        const item = document.createElement(installed ? "a" : "p");
        item.textContent = `${dependency.name || dependency.kind}: ${installed ? "Installed" : dependency.optional ? "Optional" : "Required"}${dependency.versionRange ? ` (${dependency.versionRange})` : ""}`;
        if (installed) {
            item.setAttribute("href", integrationRouteUrl({ view: "installation", id: installed.id }));
        }
        root.append(item);
    }
    if (!dependencies.length) {
        root.textContent = "No related resources declared.";
    }
}
