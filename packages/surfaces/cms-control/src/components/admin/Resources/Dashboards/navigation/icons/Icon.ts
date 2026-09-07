import { Component } from "@bernouy/components/base";
import { renderIcon } from "../icons";
import css from "./style.css" with { type: "text" };

/** A visual icon accepts scalar attributes and applies the shared SVG sanitization. */
class DashboardIcon extends Component {
    constructor() {
        super({ css, template: "<span></span>" });
    }
    static observedAttributes = ["name", "svg"];
    attributeChangedCallback(): void {
        renderIcon(
            this.shadowRoot!.querySelector("span")!,
            this.getAttribute("svg") ?? undefined,
            this.getAttribute("name") ?? undefined,
            "database",
        );
    }
}
customElements.define("cms-dashboard-icon", DashboardIcon);
