import { serializedTableRows } from "./context";
import { setValueAt } from "../../../../runtime/expressions";
import { Component } from "@bernouy/components/base";
import css from "./field.css" with { type: "text" };

/** Visual shells; data, cells and repeats remain in document light DOM. */
class TableField extends Component {
    static formAssociated = true;
    private readonly internals: ElementInternals;
    get value(): Record<string, unknown>[] {
        return serializedTableRows(
            Array.from(this.querySelectorAll<HTMLElement>("[data-table-row]")).map((row) => {
                const value: Record<string, unknown> = {};
                for (const input of Array.from(
                    row.querySelectorAll<HTMLElement & { value: string; values?: string[] }>("[data-submit-path]"),
                )) {
                    if (input.hasAttribute("data-table-row-key") && !input.value.trim()) {
                        continue;
                    }
                    setValueAt(
                        value,
                        input.dataset.submitPath!,
                        input.localName === "p9r-token-input" ? (input.values ?? []) : input.value,
                    );
                }
                return value;
            }),
        );
    }
    get form(): HTMLFormElement | null {
        return this.internals.form;
    }
    constructor() {
        super({ css, template: '<div class="table"><slot></slot></div>' });
        this.internals = this.attachInternals();
        for (const type of ["combobox-search", "combobox-load-more"]) {
            this.addEventListener(type, (event) => {
                const control = event
                    .composedPath()
                    .find(
                        (node): node is HTMLElement =>
                            node instanceof HTMLElement && node.hasAttribute("data-table-column"),
                    );
                if (!control) {
                    return;
                }
                const source = Array.from(
                    this.querySelectorAll<HTMLElement>("cms-dashboard-lookup[table-column]"),
                ).find((node) => node.getAttribute("table-column") === control.dataset.tableColumn);
                if (source) {
                    event.stopPropagation();
                    source.dispatchEvent(new CustomEvent(type, { detail: (event as CustomEvent).detail }));
                }
            });
        }
    }
}
class TableRow extends Component {
    constructor() {
        super({ css, template: '<div class="row"><slot></slot></div>' });
    }
}
customElements.define("cms-dashboard-table-field", TableField);
customElements.define("cms-dashboard-table-row", TableRow);
