import { Component } from "@bernouy/components/base";
import css from "./field.css" with { type: "text" };

/** Visual shells only: all schema controls and repeats stay in document light DOM. */
class SchemaField extends Component {
    constructor() {
        super({ css, template: '<div class="grid"><slot></slot></div>' });
    }
}
class SchemaRow extends Component {
    constructor() {
        super({ css, template: '<div class="row"><slot></slot></div>' });
    }
}
customElements.define("cms-dashboard-schema-field", SchemaField);
customElements.define("cms-dashboard-schema-row", SchemaRow);
