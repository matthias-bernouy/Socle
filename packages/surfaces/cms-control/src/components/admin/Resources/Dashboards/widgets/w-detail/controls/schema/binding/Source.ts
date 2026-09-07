import { readSourceData, refreshSourceContext, setSourceContext, setSourceData } from "@bernouy/components";
import type { DetailSchema } from "../../../../../runtime/mapping/types";

/** Owns dependency debounce and lifecycle only; binding performs the request. */
export class DashboardSchemaSource extends HTMLElement {
    static observedAttributes = ["request-base"];
    status: DetailSchema["status"] = "loading";
    private timer: ReturnType<typeof setTimeout> | undefined;
    private queued = false;

    connectedCallback(): void {
        setSourceContext(this, (value) => {
            this.status = value === undefined ? "loading" : Object.is(value, readSourceData(this)) ? "ready" : "error";
            this.refreshOwner();
            return {};
        });
        this.updateUrl(false);
    }

    disconnectedCallback(): void {
        clearTimeout(this.timer);
    }

    attributeChangedCallback(_name: string, before: string | null, after: string | null): void {
        if (before !== after && this.isConnected) {
            this.updateUrl(Boolean(before && !before.includes("{{")));
        }
    }

    private updateUrl(debounce: boolean): void {
        clearTimeout(this.timer);
        const url = this.getAttribute("request-base");
        this.setAttribute("cms-source", "");
        if (!url || url.includes("{{")) {
            this.status = "ready";
            setSourceData(this, []);
            this.refreshOwner();
            return;
        }
        this.status = "loading";
        this.refreshOwner();
        const activate = () => {
            this.setAttribute("cms-source", `${url} as schemaPayload`);
        };
        if (debounce) {
            this.timer = setTimeout(activate, 250);
        } else {
            activate();
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
customElements.define("cms-dashboard-schema-source", DashboardSchemaSource);
