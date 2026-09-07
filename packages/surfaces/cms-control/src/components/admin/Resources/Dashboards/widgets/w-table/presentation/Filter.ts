import { Component } from "@bernouy/components/base";
import css from "./filter.css" with { type: "text" };
export class DashboardTableFilter extends Component {
    constructor() {
        super({ css: css as unknown as string, template: "<span data-label></span><slot></slot>" });
    }
    static observedAttributes = ["label"];
    attributeChangedCallback(): void {
        this.shadowRoot!.querySelector("[data-label]")!.textContent = this.getAttribute("label") ?? "";
    }
    override connectedCallback(): void {
        this.addEventListener("click", this.focusControl);
    }
    disconnectedCallback(): void {
        this.removeEventListener("click", this.focusControl);
    }
    private focusControl = (event: Event): void => {
        if (event.target === this) {
            this.querySelector<HTMLElement>("input, select")?.focus();
        }
    };
}
customElements.define("cms-dashboard-table-filter", DashboardTableFilter);
