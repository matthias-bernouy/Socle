import { refreshSourceContext, setSourceContext } from "@bernouy/components";

let sequence = 0;

/** A shared directory source announces only lifecycle changes; its data stays in binding. */
export class DashboardDirectory extends HTMLElement {
    failed = false;
    private queued = false;
    connectedCallback(): void {
        this.setAttribute("cms-reload-on", `dashboard:directory:${++sequence}`);
        setSourceContext(this, (value) => {
            this.failed = Boolean(value && !Array.isArray(value) && typeof value === "object" && "status" in value);
            this.refreshOwner();
            return {};
        });
        this.refreshOwner();
    }
    retry(): void {
        if (this.failed) {
            this.failed = false;
            this.ownerDocument.dispatchEvent(new Event(this.getAttribute("cms-reload-on")!));
        }
    }
    private refreshOwner(): void {
        if (this.queued) {
            return;
        }
        this.queued = true;
        queueMicrotask(() => {
            this.queued = false;
            const owner = this.closest("cms-dashboard-w-detail");
            if (this.isConnected && owner) {
                refreshSourceContext(owner);
            }
        });
    }
}
customElements.define("cms-dashboard-directory", DashboardDirectory);
