import { Component } from "@bernouy/components/base";
import css from "./thumbnail.css" with { type: "text" };

export class MediaThumbnail extends Component {
    static observedAttributes = ["index", "selected-index", "label"];
    constructor() {
        super({ css, template: '<button type="button"><slot></slot></button>' });
    }
    attributeChangedCallback(): void {
        const selected = this.getAttribute("index") === this.getAttribute("selected-index");
        this.toggleAttribute("selected", selected);
        const button = this.shadowRoot!.querySelector("button")!;
        button.setAttribute("aria-current", String(selected));
        button.setAttribute("aria-label", this.getAttribute("label") ?? "");
        button.setAttribute("data-preview-index", this.getAttribute("index") ?? "");
    }
    override focus(): void {
        this.shadowRoot!.querySelector("button")!.focus();
    }
}
customElements.define("cms-dashboard-media-thumbnail", MediaThumbnail);
