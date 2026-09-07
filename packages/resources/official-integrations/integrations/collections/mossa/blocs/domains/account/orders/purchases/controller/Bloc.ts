import { Component } from "@bernouy/components/base";
import { purchaseCopy, purchaseLabels, syncPurchaseCopy } from "../copy";
import { syncPurchaseItems } from "../presentation";

const paramsChangeEvent = "cms-params:change";

export class PurchaseList extends Component {
    static observedAttributes = [
        "locale",
        "next-label",
        "order-action-label",
        "order-url",
        "page-param",
        "page-size",
        "previous-label",
        "pagination-previous-label",
        "pagination-next-label",
        ...Object.keys(purchaseCopy),
        ...Object.keys(purchaseLabels),
    ];

    private observer: MutationObserver | null = null;

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("mossa-pagination:change", this.onPageChange as EventListener);
        this.ownerDocument.addEventListener(paramsChangeEvent, this.onParamsChange);
        this.ownerDocument.defaultView?.addEventListener("popstate", this.onParamsChange);
        const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
        this.observer = new Observer(() => queueMicrotask(() => this.syncRenderedContent()));
        this.observer.observe(this, { childList: true, subtree: true });
        this.sync();
    }

    disconnectedCallback(): void {
        this.removeEventListener("mossa-pagination:change", this.onPageChange as EventListener);
        this.ownerDocument.removeEventListener(paramsChangeEvent, this.onParamsChange);
        this.ownerDocument.defaultView?.removeEventListener("popstate", this.onParamsChange);
        this.observer?.disconnect();
        this.observer = null;
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            queueMicrotask(() => this.sync());
        }
    }

    private sync(): void {
        const pageControl = this.querySelector<HTMLInputElement>("[data-pagination-page]");
        setAttribute(pageControl, "cms-param-sync", this.pageParam);
        setAttribute(this.source, "cms-source", this.sourceUrl(this.page));
        this.syncRenderedContent();
    }

    private syncRenderedContent(): void {
        syncPurchaseCopy(this);
        syncPurchaseItems(this);
        const pageSize = this.pageSize;
        for (const pagination of this.querySelectorAll("[data-pagination]")) {
            setAttribute(pagination, "page-size", String(pageSize));
            setAttribute(pagination, "page", String(this.page));
            setAttribute(
                pagination,
                "previous-label",
                this.getAttribute("pagination-previous-label") || this.getAttribute("previous-label") || "Previous",
            );
            setAttribute(
                pagination,
                "next-label",
                this.getAttribute("pagination-next-label") || this.getAttribute("next-label") || "Next",
            );
            setAttribute(
                pagination,
                "summary-template",
                this.getAttribute("pagination-summary-template") || "Page {page} of {pages}",
            );
            setAttribute(pagination, "tone", this.getAttribute("pagination-tone") || "neutral");
            this.clampPage(pagination);
        }
    }

    private clampPage(pagination: Element): void {
        const total = nonNegativeInteger(pagination.getAttribute("total"), 0);
        const pageCount = Math.max(1, Math.ceil(total / this.pageSize));
        if (this.page > pageCount) {
            this.setPage(pageCount);
        }
    }

    private sourceUrl(page: number): string {
        return `/.cms/sources/commerce/myOrders?limit=${this.pageSize}&offset=${(page - 1) * this.pageSize}`;
    }

    private setPage(page: number): void {
        const control = this.querySelector<HTMLInputElement>("[data-pagination-page]");
        if (!control) {
            return;
        }
        control.value = page > 1 ? String(page) : "";
        control.dispatchEvent(new Event("change", { bubbles: true }));
        setAttribute(this.source, "cms-source", this.sourceUrl(page));
    }

    private onPageChange = (event: CustomEvent<{ page?: number }>): void => {
        if (event.target instanceof Element && event.target.matches("[data-pagination]")) {
            this.setPage(positiveInteger(event.detail?.page, 1));
        }
    };

    private onParamsChange = (): void => {
        setAttribute(this.source, "cms-source", this.sourceUrl(this.page));
        this.syncRenderedContent();
    };

    private get source(): Element | null {
        return this.querySelector("[data-purchases-source]");
    }

    private get page(): number {
        const href = this.ownerDocument.defaultView?.location.href || "http://localhost/";
        return positiveInteger(new URL(href).searchParams.get(this.pageParam), 1);
    }

    private get pageSize(): number {
        return Math.min(50, positiveInteger(this.getAttribute("page-size"), 8));
    }

    private get pageParam(): string {
        return this.getAttribute("page-param")?.trim() || "page";
    }
}

function positiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function setAttribute(element: Element | null, name: string, value: string): void {
    if (element && element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", PurchaseList);
