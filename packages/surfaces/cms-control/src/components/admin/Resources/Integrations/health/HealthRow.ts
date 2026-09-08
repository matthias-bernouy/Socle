import { Component } from "@bernouy/components/base";
import css from "./presentation/healthRow.css" with { type: "text" };
import "./HealthOperations";

/** Disclosure geometry is isolated; source declarations and controls remain in light DOM. */
class HealthRow extends Component {
    constructor() {
        super({
            css,
            template:
                '<details><summary><span class="indicator" aria-hidden="true"></span><slot name="heading"></slot><slot name="status"></slot><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="content"><slot></slot></div></details>',
        });
    }
    override connectedCallback(): void {
        super.connectedCallback();
        this.shadowRoot!.querySelector("details")!.addEventListener("toggle", this.expand);
    }
    disconnectedCallback(): void {
        this.shadowRoot?.querySelector("details")?.removeEventListener("toggle", this.expand);
    }
    private expand = (): void => {
        if (!this.shadowRoot!.querySelector("details")!.open || this.querySelector("cms-health-operations")) {
            return;
        }
        const operations = document.createElement("cms-health-operations");
        operations.setAttribute("installation-id", this.getAttribute("installation-id")!);
        this.append(operations);
    };
}
customElements.define("cms-health-row", HealthRow);
