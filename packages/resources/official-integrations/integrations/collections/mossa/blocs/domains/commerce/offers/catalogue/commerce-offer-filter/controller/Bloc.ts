import { NumericRangeFilters } from "../range/range-controller";
import { SchemaOfferFilters } from "../schema/schema";

export class CommerceOfferFilter extends HTMLElement {
    static observedAttributes = [
        "category-param",
        "schema-driven",
        "show-brand",
        "all-label",
        "boolean-true-label",
        "boolean-false-label",
        "error-label",
    ];

    constructor() {
        super();
        this.schemaFilters = null;
        this.numericRangeFilters = null;
        this.authoredTemplate = null;
        this.schemaModeActive = false;
    }

    connectedCallback() {
        if (this.schemaSource) {
            this.append(this.schemaSource);
        }
        this.setAttribute("data-commerce-offer-filter", "");
        if (this.hasAttribute("data-numeric-range")) {
            this.style.display = "grid";
            this.numericRangeFilters ||= new NumericRangeFilters(this);
            this.numericRangeFilters.connect();
            return;
        }
        if (!this.schemaDriven) {
            this.style.display = "contents";
            return;
        }
        this.activateSchemaMode();
    }

    disconnectedCallback() {
        if (this.hasAttribute("data-numeric-range")) {
            this.numericRangeFilters?.disconnect();
            return;
        }
        this.deactivateSchemaMode();
    }

    attributeChangedCallback(name) {
        if (!this.isConnected) {
            return;
        }
        if (!this.schemaDriven) {
            this.deactivateSchemaMode();
            return;
        }
        this.activateSchemaMode();
        if (name !== "category-param" && name !== "schema-driven") {
            this.schemaFilters.render();
        }
    }

    activateSchemaMode() {
        const source = this.schemaSource;
        if (!this.schemaModeActive) {
            this.authoredTemplate =
                [...this.children].find(
                    (child) => child.localName === "template" && child.hasAttribute("data-authored-filter-content"),
                ) || this.ownerDocument.createElement("template");
            if (!this.authoredTemplate.hasAttribute("data-authored-filter-content")) {
                this.authoredTemplate.setAttribute("data-authored-filter-content", "");
                this.authoredTemplate.content.append(...[...this.childNodes].filter((node) => node !== source));
                this.insertBefore(this.authoredTemplate, source);
            }
            this.schemaModeActive = true;
        }
        this.style.display = "block";
        this.schemaFilters ||= new SchemaOfferFilters(this);
        this.schemaFilters.connect();
        this.schemaFilters.renderCurrent();
    }

    deactivateSchemaMode() {
        this.schemaFilters?.disconnect();
        this.removeAttribute("data-schema-category");
        this.removeAttribute("data-schema-status");
        if (this.schemaModeActive) {
            const authoredContent = this.authoredTemplate?.content;
            const source = this.schemaSource;
            this.replaceChildren(...(authoredContent ? [authoredContent] : []), ...(source ? [source] : []));
            this.authoredTemplate = null;
            this.schemaModeActive = false;
        }
        this.style.display = "contents";
    }

    managedParams() {
        return this.schemaFilters?.managedParams() ?? [];
    }

    get schemaSource() {
        return [...this.children].find((child) => child.hasAttribute("data-offer-filter-schema-source")) || null;
    }

    get schemaDriven() {
        return this.hasAttribute("schema-driven") && this.getAttribute("schema-driven") !== "false";
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", CommerceOfferFilter);
