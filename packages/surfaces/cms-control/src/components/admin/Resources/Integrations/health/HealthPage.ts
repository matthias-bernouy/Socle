import { readSourceData, refreshSourceContext, setSourceContext } from "@bernouy/components";
import type { IntegrationInstallationRow } from "../model";
import { route } from "../api";
import markup from "cms-control/static/admin/_operations/health/overview.html" with { type: "text" };
import "./HealthSummary";
import "./HealthRow";
import "./HealthUpgrades";

class HealthPage extends HTMLElement {
    private observations = new Map<string, { ready: boolean; observed: boolean }>();
    connectedCallback(): void {
        const template = document.createElement("template");
        template.innerHTML = markup as unknown as string;
        this.replaceChildren(template.content.cloneNode(true));
        let items: { id: string; label: string; version: string; deployment: string }[] = [];
        setSourceContext(this, () => {
            const data = readSourceData(this);
            const rows: IntegrationInstallationRow[] = Array.isArray(data) ? data : [];
            items = rows.map((item, index) => {
                const previous = items[index];
                const values = {
                    id: item.id,
                    label: item.label,
                    version: item.definitionVersion,
                    deployment: item.status.replaceAll("_", " "),
                };
                return previous?.id === item.id ? Object.assign(previous, values) : values;
            });
            const statuses = items.map((item) => this.observations.get(item.id));
            const ready = statuses.filter((state, index) => state?.ready && rows[index]?.status === "success").length;
            const observed = statuses.filter((state) => state?.observed).length;
            return {
                healthItems: items,
                healthTotal: `${ready}/${items.length} integrations ready`,
                healthCoverage: `${observed} observed · ${items.length - observed} awaiting valid checks`,
            };
        });
        this.setAttribute("cms-source", `${route("/api/integrations/installations")} as installations`);
        this.setAttribute("cms-reload-on", "health:installations");
        this.addEventListener("click", this.refresh);
        this.addEventListener("health:observation", this.observation);
        document.addEventListener("integration:updated", this.reload);
    }
    disconnectedCallback(): void {
        this.removeEventListener("click", this.refresh);
        this.removeEventListener("health:observation", this.observation);
        document.removeEventListener("integration:updated", this.reload);
    }
    private observation = (event: Event): void => {
        const detail = (event as CustomEvent).detail;
        this.observations.set(detail.id, detail);
        refreshSourceContext(this);
    };
    private refresh = (event: Event): void => {
        if (!(event.target as Element).closest("[data-health-refresh-all]")) {
            return;
        }
        this.reload();
    };
    private reload = (): void => {
        this.ownerDocument.dispatchEvent(new Event("health:installations"));
        for (const summary of Array.from(
            this.querySelectorAll<HTMLElement & { refresh(): void }>("cms-health-summary, cms-health-operations"),
        )) {
            summary.refresh();
        }
    };
}
customElements.define("cms-health-page", HealthPage);
