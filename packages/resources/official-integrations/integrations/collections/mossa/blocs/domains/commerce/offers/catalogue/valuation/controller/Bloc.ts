import { Component } from "@bernouy/components/base";
import { productValuation, readProducts, type ValuationProduct, valuationMoney } from "../presentation";

type SearchElement = HTMLElement & { value?: string };

export class ValuationController extends Component {
    static observedAttributes = ["currency", "valuation-maximum-field", "valuation-minimum-field"];

    private products = new Map<string, ValuationProduct>();
    private hasSearched = false;
    private requestedQuery = "";
    private searchTimer?: number;
    private selectedProduct: ValuationProduct | null = null;

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("input", this.onSearchInput);
        this.addEventListener("focusin", this.onSearchFocus);
        this.addEventListener("click", this.onClick);
        this.addEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.addEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        this.setStatus(this.copy("start-typing-message"));
    }

    disconnectedCallback(): void {
        this.removeEventListener("input", this.onSearchInput);
        this.removeEventListener("focusin", this.onSearchFocus);
        this.removeEventListener("click", this.onClick);
        this.removeEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.removeEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        this.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
    }

    attributeChangedCallback(): void {
        if (this.isConnected && this.selectedProduct) {
            this.showProduct(this.selectedProduct);
        }
    }

    private onSearchInput = (event: Event): void => {
        if (event.target !== this.search) {
            return;
        }
        this.setStatus(this.copy("searching-message"));
        this.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
        this.searchTimer = this.ownerDocument.defaultView?.setTimeout(() => this.loadSearch(), 180);
    };

    private onSearchFocus = (event: FocusEvent): void => {
        if (event.target === this.search && !this.hasSearched) {
            this.loadSearch();
        }
    };

    private onClick = (event: Event): void => {
        const action = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-product-id]") : null;
        const product = action ? this.products.get(action.dataset.productId || "") : null;
        if (!product) {
            return;
        }
        this.selectedProduct = product;
        this.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
        this.showProduct(product);
    };

    private onSourceSuccess = (event: CustomEvent<{ body?: unknown }>): void => {
        if (event.target !== this.source) {
            return;
        }
        const products = readProducts(event.detail?.body);
        this.products = new Map(products.map((product) => [product.id, product]));
        this.setStatus(
            products.length === 0
                ? this.copy("no-model-message")
                : this.copy(products.length === 1 ? "model-count-one-message" : "model-count-many-message", {
                      count: String(products.length),
                  }),
        );
        if ((this.search?.value?.trim() || "") !== this.requestedQuery) {
            this.loadSearch();
        }
    };

    private onSourceFailed = (event: Event): void => {
        if (event.target === this.source) {
            this.products.clear();
            this.setStatus(this.copy("unavailable-message"));
            if ((this.search?.value?.trim() || "") !== this.requestedQuery) {
                this.loadSearch();
            }
        }
    };

    private loadSearch(): void {
        const query = this.search?.value?.trim() || "";
        const control = this.querySelector<HTMLInputElement>("[data-search-query]");
        if (!control) {
            return;
        }
        this.hasSearched = true;
        this.requestedQuery = query;
        control.value = query;
        this.source.requestSubmit();
    }

    private showProduct(product: ValuationProduct): void {
        if (this.search) {
            this.search.value = product.title;
        }
        setText(this.querySelector("[data-product-title]"), product.title);
        setText(
            this.querySelector("[data-product-description]"),
            product.description || this.copy("catalogue-product-label"),
        );
        const valuation = productValuation(product.metadata, this.minimumField, this.maximumField);
        setText(
            this.querySelector("[data-estimate]"),
            valuation
                ? `${valuationMoney(valuation.minimum, this.currency, this.locale)} – ${valuationMoney(valuation.maximum, this.currency, this.locale)}`
                : this.copy("range-pending-label"),
        );
        setText(
            this.querySelector("[data-detail]"),
            this.copy(valuation ? "range-description" : "range-pending-description"),
        );
        this.querySelector<HTMLElement>("[data-valuation-result]")?.toggleAttribute("hidden", false);
        this.querySelector<HTMLElement>("[data-initial-state]")?.toggleAttribute("hidden", true);
        this.setStatus(this.copy("selected-model-message", { title: product.title }));
    }

    private copy(name: string, replacements: Readonly<Record<string, string>> = {}): string {
        let value = this.querySelector(`[data-copy-source="${name}"]`)?.textContent?.trim() || "";
        for (const [key, replacement] of Object.entries(replacements)) {
            value = value.replaceAll(`{${key}}`, replacement);
        }
        return value;
    }

    private setStatus(value: string): void {
        setText(this.querySelector("[data-search-status]"), value);
    }

    private get search(): SearchElement | null {
        return this.querySelector("[data-search]");
    }

    private get source(): HTMLFormElement {
        return this.querySelector<HTMLFormElement>("[data-products-source]")!;
    }

    private get currency(): string {
        return (this.getAttribute("currency")?.trim() || "USD").toUpperCase();
    }

    private get minimumField(): string {
        return this.getAttribute("valuation-minimum-field")?.trim() || "valuationMinimum";
    }

    private get maximumField(): string {
        return this.getAttribute("valuation-maximum-field")?.trim() || "valuationMaximum";
    }

    private get locale(): string {
        return (
            this.ownerDocument.documentElement.lang.trim() ||
            this.ownerDocument.defaultView?.navigator.language ||
            "en-US"
        );
    }
}

function setText(element: Element | null, value: string): void {
    if (element && element.textContent !== value) {
        element.textContent = value;
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", ValuationController);
