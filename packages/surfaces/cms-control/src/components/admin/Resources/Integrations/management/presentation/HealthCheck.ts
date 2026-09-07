import { Component } from "@bernouy/components/base";
import css from "./healthCheck.css" with { type: "text" };

/** Visual row only; its check text and recovery actions are slotted binding declarations. */
class HealthCheck extends Component {
    constructor() {
        super({ css, template: "<slot></slot>" });
    }
}
customElements.define("cms-integration-health-check", HealthCheck);
