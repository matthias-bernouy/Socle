import { Component } from "@bernouy/components/base";
import css from "./field.css" with { type: "text" };

/** Visual shells; data, cells and repeats remain in document light DOM. */
class TableField extends Component {
    constructor() {
        super({ css, template: '<div class="table"><slot></slot></div>' });
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
