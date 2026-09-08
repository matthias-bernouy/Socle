import type { IntegrationHealthEnvelope, IntegrationManagement } from "@bernouy/cms-integrations";
import { observeSource, readSourceData, refreshSourceContext, setSourceContext } from "@bernouy/components";
import { route } from "../../api";
import { healthContext } from "./healthContext";
import markup from "cms-control/static/admin/_operations/health/checks.html" with { type: "text" };
import "./HealthCheck";

/** Compose once from an integration contract; no response data enters this function. */
export function mountHealth(
    root: HTMLElement,
    id: string,
    management: IntegrationManagement,
    run: (id: string) => void,
) {
    const host = document.createElement("div");
    host.dataset.integrationHealth = "";
    const url = `${route("/api/integrations/management/health")}?id=${encodeURIComponent(id)}`;
    const reload = `integration:${encodeURIComponent(id)}:health:reload`;
    host.setAttribute("cms-source", `${url} as health`);
    host.setAttribute("cms-reload-on", reload);
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    host.append(template.content.cloneNode(true));
    let loading = true;
    const project = healthContext(management);
    setSourceContext(host, () => {
        const value = readSourceData(host) as IntegrationHealthEnvelope | null | undefined;
        return { ...project(value ?? undefined), healthBusy: loading };
    });
    const stop = observeSource(host, (state) => {
        if (state.disposed) {
            stop();
            return;
        }
        const pending = state.loading || state.refreshing === true;
        if (loading !== pending) {
            loading = pending;
            refreshSourceContext(host);
        }
    });
    const refresh = () => {
        // A completed action must supersede any observation started before it completed.
        if (!host.isConnected) {
            return;
        }
        loading = true;
        const next = `${url}&refresh=true as health`;
        if (host.getAttribute("cms-source") !== next) {
            host.setAttribute("cms-source", next);
        } else {
            host.ownerDocument.dispatchEvent(new Event(reload));
        }
    };
    host.addEventListener("click", (event) => {
        const target = (event.target as Element | null)?.closest<HTMLElement>(
            "[data-health-refresh], [data-health-action]",
        );
        if (!loading && target?.hasAttribute("data-health-refresh")) {
            refresh();
        } else if (!loading && target?.dataset.healthAction) {
            run(target.dataset.healthAction);
        }
    });
    root.replaceChildren(host);
    return { element: host, refresh };
}
