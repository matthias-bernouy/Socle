import { Component } from "@bernouy/components/base";
import { readReorderableItems } from "./context";
import { ReorderableInteractions } from "./interactions";
import css from "./field.css" with { type: "text" };

/** Visual shells contain slots; the document binding owns rows and field values. */
export class ReorderableField extends Component {
    private readonly interactions = new ReorderableInteractions(this);
    constructor() {
        super({
            css,
            template:
                '<section class="reorderable-list"><div class="header"><slot name="heading"></slot></div><div class="rows"><slot name="row"></slot></div><slot name="add"></slot></section>',
        });
    }
    get items(): Record<string, unknown>[] {
        return this.interactions.pending ?? readReorderableItems(this);
    }
    override connectedCallback(): void {
        this.interactions.connect();
    }
    disconnectedCallback(): void {
        this.interactions.disconnect();
    }
}

class ReorderableRow extends Component {
    constructor() {
        super({ css, template: "<slot></slot>" });
    }
}

class ReorderableCell extends Component {
    static observedAttributes = ["label"];
    constructor() {
        super({ css, template: '<span class="field-label"></span><slot></slot>' });
    }
    attributeChangedCallback(): void {
        this.shadowRoot!.querySelector(".field-label")!.textContent = this.getAttribute("label") ?? "";
    }
}

class ReorderableSettings extends Component {
    constructor() {
        super({
            css,
            template: '<details class="card-details"><summary>Choice settings</summary><slot></slot></details>',
        });
    }
}

class ReorderableToolbar extends Component {
    constructor() {
        super({ css, template: "<slot></slot>" });
    }
}

customElements.define("cms-dashboard-reorderable-field", ReorderableField);
customElements.define("cms-dashboard-reorderable-row", ReorderableRow);
customElements.define("cms-dashboard-reorderable-cell", ReorderableCell);
customElements.define("cms-dashboard-reorderable-settings", ReorderableSettings);
customElements.define("cms-dashboard-reorderable-toolbar", ReorderableToolbar);
