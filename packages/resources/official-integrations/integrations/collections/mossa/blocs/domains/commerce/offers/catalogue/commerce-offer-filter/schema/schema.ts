import { filterControls, filterableFields } from "./schema-helpers";
import { prepareSchemaFilterParams } from "./schema-params";
import { renderSchema, renderSchemaState } from "./render-schema";

export class SchemaOfferFilters {
    constructor(host) {
        this.host = host;
        this.category = "";
        this.schema = null;
        this.scheduled = false;
        this.inFlightCategory = "";
        this.connected = false;
        this.sourceListenersConnected = false;
        this.scheduleTimer = null;
    }

    connect() {
        if (this.connected) {
            this.schedule();
            return;
        }
        this.connected = true;
        if (!this.schema) {
            this.host.setAttribute("data-schema-status", "pending");
        }
        this.host.ownerDocument.addEventListener("cms-params:change", this.schedule);
        this.host.ownerDocument.defaultView?.addEventListener("popstate", this.schedule);
        if (!this.sourceListenersConnected && this.source) {
            this.sourceListenersConnected = true;
            this.source.addEventListener("cms-source:success", this.onSourceSuccess);
            this.source.addEventListener("cms-source:failed", this.onSourceFailed);
        }
        this.schedule();
    }

    disconnect() {
        if (!this.connected) {
            return;
        }
        this.connected = false;
        this.host.ownerDocument.removeEventListener("cms-params:change", this.schedule);
        this.host.ownerDocument.defaultView?.removeEventListener("popstate", this.schedule);
        this.scheduled = false;
        if (this.scheduleTimer) {
            clearTimeout(this.scheduleTimer);
            this.scheduleTimer = null;
        }
    }

    invalidate() {
        this.category = "";
        this.schema = null;
        this.host.setAttribute("data-schema-status", "pending");
        this.schedule();
    }

    render() {
        if (this.schema) {
            renderSchema(this.host, this.schema);
        }
    }

    renderCurrent() {
        if (this.schema && this.category === this.currentCategory()) {
            this.render();
        }
    }

    schedule = () => {
        if (this.scheduled) {
            return;
        }
        this.scheduled = true;
        this.scheduleTimer = setTimeout(() => {
            this.scheduled = false;
            this.scheduleTimer = null;
            if (this.host.isConnected) {
                void this.sync();
            }
        }, 0);
    };

    sync() {
        const category = this.currentCategory();
        if (!category) {
            if (this.category) {
                this.clearManagedParams();
            }
            this.category = "";
            this.schema = null;
            this.host.removeAttribute("data-schema-category");
            renderSchemaState(this.host, "idle");
            return;
        }
        if (category === this.category && this.schema) {
            return;
        }
        if (this.category && category !== this.category) {
            this.clearManagedParams();
        }
        this.category = category;
        if (this.inFlightCategory) {
            return;
        }
        renderSchemaState(this.host, "loading");
        this.load(category);
    }

    managedParams() {
        const fields = filterableFields(this.schema);
        return [
            ...(this.host.getAttribute("show-brand") === "false" ? [] : ["brand"]),
            ...fields.flatMap((field) => filterControls(field).map((control) => control.param)),
        ];
    }

    load(category) {
        const source = this.source;
        const input = source?.querySelector("[data-schema-category-input]");
        if (!source || !input) {
            this.fail();
            return;
        }
        input.value = category;
        this.inFlightCategory = category;
        queueMicrotask(() => source.isConnected && source.requestSubmit());
    }

    onSourceSuccess = (event) => {
        if (event.target !== this.source) {
            return;
        }
        const category = this.inFlightCategory;
        this.inFlightCategory = "";
        if (!this.connected || !category || category !== this.currentCategory()) {
            this.schedule();
            return;
        }
        const body = event.detail?.body;
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            this.fail();
            return;
        }
        prepareSchemaFilterParams(this.host, body);
        this.schema = body;
        renderSchema(this.host, body);
    };

    onSourceFailed = (event) => {
        if (event.target !== this.source) {
            return;
        }
        const category = this.inFlightCategory;
        this.inFlightCategory = "";
        if (category && category !== this.currentCategory()) {
            this.schedule();
            return;
        }
        this.fail();
    };

    fail() {
        this.schema = null;
        renderSchemaState(
            this.host,
            "error",
            this.host.getAttribute("error-label") || "Filters for this category could not be loaded.",
        );
    }

    get source() {
        return this.host.schemaSource;
    }

    clearManagedParams() {
        if (typeof location === "undefined" || typeof history === "undefined") {
            return;
        }
        const params = new URLSearchParams(location.search);
        let changed = false;
        for (const name of this.managedParams()) {
            if (params.has(name)) {
                params.delete(name);
                changed = true;
            }
        }
        if (!changed) {
            return;
        }
        const query = params.toString();
        history.replaceState(history.state, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
        queueMicrotask(() => this.host.ownerDocument.dispatchEvent(new Event("cms-params:change")));
    }

    currentCategory() {
        if (typeof location === "undefined") {
            return "";
        }
        return (
            new URLSearchParams(location.search).get(this.host.getAttribute("category-param") || "category")?.trim() ||
            ""
        );
    }
}
