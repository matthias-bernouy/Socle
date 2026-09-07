import { Component } from "@bernouy/components/base";
import { saleStatusDefaults } from "../helpers";
import { syncSalePresentation } from "../presentation";

const defaultCopy = {
    "articles-title": "Sold items",
    "back-label": "Back to sales",
    "commission-label": "Platform commission",
    "date-prefix": "Sold on",
    "error-message": "This sale could not be loaded.",
    "error-title": "Sale not found",
    eyebrow: "SALE",
    "fallback-article-label": "Item",
    "platform-shipping-label": "Covered by the platform",
    "quantity-label": "Quantity",
    "shipping-label": "Delivery",
    "subtotal-label": "Sale price",
    "summary-title": "Summary",
    "total-label": "Net amount to receive",
};

export class CommerceSaleDetailController extends Component {
    static observedAttributes = [
        "sale-id",
        "order-param",
        "locale",
        "card-appearance",
        ...Object.keys(defaultCopy),
        ...Object.keys(saleStatusDefaults).map((status) => `label-${status}`),
    ];

    private observer: MutationObserver | null = null;

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.ownerDocument.defaultView?.addEventListener("popstate", this.onLocationChange);
        const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
        this.observer = new Observer(() => queueMicrotask(() => this.syncPresentation()));
        this.observer.observe(this, { childList: true, subtree: true });
        this.sync();
    }

    disconnectedCallback(): void {
        this.ownerDocument.defaultView?.removeEventListener("popstate", this.onLocationChange);
        this.observer?.disconnect();
        this.observer = null;
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            queueMicrotask(() => this.sync());
        }
    }

    private sync(): void {
        const id = this.saleId;
        if (id) {
            setAttribute(
                this.querySelector("[data-sale-source]"),
                "cms-source",
                `/.cms/sources/commerce/mySale?id=${encodeURIComponent(id)}`,
            );
        }
        this.syncPresentation();
    }

    private syncPresentation(): void {
        for (const [name, fallback] of Object.entries(defaultCopy)) {
            for (const element of this.querySelectorAll(`[data-sale-copy="${name}"]`)) {
                const value = this.text(name, fallback);
                if (element.textContent !== value) {
                    element.textContent = value;
                }
            }
        }
        for (const card of this.querySelectorAll("[data-sale-card]")) {
            setAttribute(card, "appearance", this.getAttribute("card-appearance") || "outlined");
        }
        for (const action of this.querySelectorAll("[data-error-back]")) {
            const value = this.text("back-label", defaultCopy["back-label"]);
            if (action.textContent !== value) {
                action.textContent = value;
            }
        }
        const fulfillment = this.querySelector<HTMLElement>("[data-fulfillment]");
        fulfillment?.toggleAttribute("hidden", fulfillment.childElementCount === 0);
        syncSalePresentation(this);
    }

    private onLocationChange = (): void => this.sync();

    get saleId(): string {
        const href = this.ownerDocument.defaultView?.location.href || "http://localhost/";
        return (
            this.getAttribute("sale-id")?.trim() ||
            new URL(href).searchParams.get(this.getAttribute("order-param")?.trim() || "orderId") ||
            ""
        );
    }

    get locale(): string {
        return this.getAttribute("locale")?.trim() || "en-US";
    }

    text(name: string, fallback: string): string {
        return this.getAttribute(name)?.trim() || fallback;
    }

    statusLabel(status: string): string {
        return this.getAttribute(`label-${status}`)?.trim() || saleStatusDefaults[status] || "To review";
    }
}

function setAttribute(element: Element | null, name: string, value: string): void {
    if (element && element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", CommerceSaleDetailController);
