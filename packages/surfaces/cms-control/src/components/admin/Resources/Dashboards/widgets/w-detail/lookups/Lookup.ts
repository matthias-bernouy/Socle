import { readSourceData, refreshSourceContext, setSourceContext, setSourceData } from "@bernouy/components";
import type { DashboardOption } from "@bernouy/cms-dashboards";
import { distinctOptions, lookupPage, selectedLookupOptions } from "./options";

let sequence = 0;

/** Light-DOM source controller: local query/pagination state, no fetching or DOM renderer. */
export class DashboardLookup extends HTMLElement {
    static observedAttributes = ["request-base", "selected-value"];
    private timer: ReturnType<typeof setTimeout> | undefined;
    private query = "";
    private offset = 0;
    private received = 0;
    private acceptedOffset = 0;
    private pending = false;
    private hasMore = false;
    private previous: unknown;
    private options: DashboardOption[] = [];
    private created: DashboardOption[] = [];
    private declared: DashboardOption[] = [];

    connectedCallback(): void {
        this.declared = Array.from(this.querySelectorAll<HTMLOptionElement>("[data-static-options] option")).map(
            (option) => ({ value: option.value, label: option.textContent ?? option.value }),
        );
        this.setAttribute("cms-reload-on", `dashboard:lookup:${++sequence}`);
        setSourceContext(this, (value) => this.context(value));
        this.addEventListener("combobox-search", this.onSearch);
        this.addEventListener("combobox-load-more", this.onMore);
        this.updateUrl();
        if (!this.getAttribute("cms-source")) {
            setSourceData(this, {});
        }
    }
    disconnectedCallback(): void {
        clearTimeout(this.timer);
        this.removeEventListener("combobox-search", this.onSearch);
        this.removeEventListener("combobox-load-more", this.onMore);
    }
    attributeChangedCallback(name: string, before: string | null, after: string | null): void {
        if (before === after || !this.isConnected) {
            return;
        }
        if (name === "request-base") {
            clearTimeout(this.timer);
            this.query = "";
            this.offset = 0;
            this.updateUrl();
        } else {
            refreshSourceContext(this);
        }
    }
    acceptCreatedOption(option: DashboardOption): void {
        this.created = distinctOptions([...this.created, option]);
        refreshSourceContext(this);
    }
    private context(rendered: unknown) {
        if (rendered !== undefined) {
            this.pending = false;
        }
        const payload = readSourceData(this);
        if (payload !== undefined && !Object.is(payload, this.previous)) {
            this.previous = payload;
            this.acceptedOffset = this.offset;
            const page = lookupPage(this, payload);
            this.options = distinctOptions(this.offset ? [...this.options, ...page.options] : page.options);
            this.received = page.received;
            this.hasMore =
                Boolean(this.getAttribute("offset-params")) &&
                (page.total === undefined ? page.received >= 25 : this.offset + page.received < page.total);
        }

        return {
            lookupValue: this.getAttribute("selected-value") ?? "",
            lookupOptions: distinctOptions([
                ...this.declared,
                ...this.options,
                ...this.created,
                ...selectedLookupOptions(this),
            ]),
            lookupHasMore: this.hasMore,
        };
    }
    private updateUrl(retry = false): void {
        const base = this.getAttribute("request-base");
        if (!base || base.includes("{{")) {
            this.offset = 0;
            this.setAttribute("cms-source", "");
            setSourceData(this, {});
            return;
        }
        const url = new URL(base, this.ownerDocument.location.href);
        for (const [attribute, value] of [
            ["search-params", this.query],
            ["offset-params", String(this.offset)],
        ] as const) {
            for (const key of (this.getAttribute(attribute) ?? "").split(" ").filter(Boolean)) {
                if (attribute === "search-params" && value === "") {
                    url.searchParams.delete(key);
                } else {
                    url.searchParams.set(key, value);
                }
            }
        }
        const source = `${url.pathname}${url.search} as lookupData`;
        if (this.getAttribute("cms-source") !== source) {
            this.pending = true;
            this.setAttribute("cms-source", source);
        } else if (retry) {
            this.pending = true;
            this.ownerDocument.dispatchEvent(new Event(this.getAttribute("cms-reload-on")!));
        }
    }
    private onSearch = (event: Event): void => {
        if (!this.getAttribute("search-params")) {
            return;
        }
        event.stopPropagation();
        const query = (event as CustomEvent<{ query?: unknown }>).detail?.query;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.query = typeof query === "string" ? query.slice(0, 200) : "";
            this.offset = 0;
            this.updateUrl(true);
        }, 250);
    };
    private onMore = (event: Event): void => {
        event.stopPropagation();
        if (this.hasMore && !this.pending) {
            this.offset = this.acceptedOffset + this.received;
            this.updateUrl(true);
        }
    };
}
customElements.define("cms-dashboard-lookup", DashboardLookup);
