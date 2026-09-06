import { Component } from "@bernouy/components/base";
import css from "./field.css" with { type: "text" };

/** Visual field wrapper: its slotted control and bindings remain in light DOM. */
export class DashboardDetailField extends Component {
    constructor() {
        super({ css, template: "<dl><dt></dt><dd><slot></slot></dd></dl>" });
    }
    static observedAttributes = ["label", "required", "internal-label"];
    attributeChangedCallback(): void {
        this.shadowRoot!.querySelector("dt")!.textContent = this.getAttribute("label") ?? "";
    }
}
customElements.define("cms-dashboard-detail-field", DashboardDetailField);
