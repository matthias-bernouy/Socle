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
        const result: Record<string, unknown> = {};
        for (const input of Array.from(
            this.querySelectorAll<HTMLElement & { value: string; checked?: boolean }>(
                "[data-schema-key]:not([disabled]):not([readonly])",
            ),
        )) {
            const key = input.dataset.schemaKey!;
            if (["__proto__", "constructor", "prototype"].includes(key)) {
                throw new Error("Invalid metadata field key.");
            }
            result[key] =
                typeof input.checked === "boolean"
                    ? input.checked
                    : input.value === ""
                      ? null
                      : input.getAttribute("type") === "number"
                        ? Number(input.value)
                        : input.value;
        }
        return result;
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
