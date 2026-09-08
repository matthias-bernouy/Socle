import { observeSource, readSourceData, setSourceContext } from "@bernouy/components";
import type { IntegrationHealthEnvelope } from "@bernouy/cms-integrations";
import { route } from "../api";
import { summarizeHealth } from "./presentation/summary";
import markup from "cms-control/static/admin/_operations/health/summary.html" with { type: "text" };

/** Light DOM declarations participate in the page binding. */
class HealthSummary extends HTMLElement {
    static observedAttributes = ["installation-id"];
    private mounted = false;
    private stop?: () => void;
    connectedCallback(): void {
        if (!this.mounted) {
            const template = document.createElement("template");
            template.innerHTML = markup as unknown as string;
            this.replaceChildren(template.content.cloneNode(true));
            setSourceContext(this, () => {
                const summary = summarizeHealth(readSourceData(this) as IntegrationHealthEnvelope | undefined);
                return { healthStatus: summary.label, healthCount: summary.count };
            });
            this.mounted = true;
        }
        this.sync();
        this.stop = observeSource(this, (state) => {
            const summary = summarizeHealth(
                state.data as IntegrationHealthEnvelope | undefined,
                Boolean(state.error || state.refreshError),
            );
            this.closest("cms-health-row")?.setAttribute(
                "health-state",
                summary.ready ? "ready" : summary.observed ? "attention" : "unknown",
            );
            this.dispatchEvent(
                new CustomEvent("health:observation", {
                    bubbles: true,
                    detail: { id: this.getAttribute("installation-id"), ...summary },
                }),
            );
        });
    }
    disconnectedCallback(): void {
        this.stop?.();
    }
    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.sync();
        }
    }
    refresh(): void {
        this.sync(true);
    }
    private sync(refresh = false): void {
        const id = this.getAttribute("installation-id");
        if (!id || id.includes("{{")) {
            return;
        }
        const event = `health:summary:${encodeURIComponent(id)}`;
        const source = `${route("/api/integrations/management/health")}?id=${encodeURIComponent(id)}${refresh ? "&refresh=true" : ""} as health`;
        this.setAttribute("cms-reload-on", event);
        if (this.getAttribute("cms-source") !== source) {
            this.setAttribute("cms-source", source);
        } else if (refresh) {
            this.ownerDocument.dispatchEvent(new Event(event));
        }
    }
}
customElements.define("cms-health-summary", HealthSummary);
