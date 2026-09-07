import { refreshSourceContext, setSourceContext } from "@bernouy/components";
import { route } from "../../api";
import { isDashboardExampleMode } from "../mode";

/** Announce source lifecycle only; installation values stay owned by the binding source. */
class NavigationInstallations extends HTMLElement {
    private queued = false;
    connectedCallback(): void {
        const owner = this.closest("cms-dashboards-nav");
        if (!owner || isDashboardExampleMode(owner as HTMLElement)) {
            return;
        }
        setSourceContext(this, () => {
            if (!this.queued) {
                this.queued = true;
                queueMicrotask(() => {
                    this.queued = false;
                    if (this.isConnected) {
                        refreshSourceContext(owner);
                    }
                });
            }
            return {};
        });
        this.setAttribute("cms-source", `${route("/api/integrations/installations")} as installations`);
    }
}
customElements.define("cms-dashboard-nav-installations", NavigationInstallations);
