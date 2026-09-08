import { Component } from "@bernouy/components/base";
import css from "./field.css" with { type: "text" };

/** Visual shells only: all schema controls and repeats stay in document light DOM. */
class SchemaField extends Component {
    static formAssociated = true;
    private readonly internals: ElementInternals;
    get form(): HTMLFormElement | null {
        return this.internals.form;
    }
    get value(): Record<string, unknown> {
        // The detail draft already preserves opaque and temporarily hidden metadata.
        // Read it through the same field reader used for validation and dirty tracking.
        const detail = this.closest<HTMLElement & { currentFieldValues(): Record<string, unknown> }>(
            "cms-dashboard-w-detail",
        );
        return (detail?.currentFieldValues()[this.dataset.fieldControl ?? ""] ?? {}) as Record<string, unknown>;
    }
    constructor() {
        super({ css, template: '<div class="grid"><slot></slot></div>' });
        this.internals = this.attachInternals();
    }
}
class SchemaRow extends Component {
    constructor() {
        super({ css, template: '<div class="row"><slot></slot></div>' });
    }
}
customElements.define("cms-dashboard-schema-field", SchemaField);
customElements.define("cms-dashboard-schema-row", SchemaRow);
