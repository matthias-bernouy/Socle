/** Receives typed binding values in light DOM; the enclosing widget owns presentation. */
export class DashboardInput extends HTMLElement {
    private value: unknown;
    setBindingValue(value: unknown): void {
        this.value = value;
        this.deliver();
    }
    connectedCallback(): void {
        this.deliver();
    }
    private deliver(): void {
        if (this.isConnected && this.value !== undefined) {
            this.dispatchEvent(
                new CustomEvent("dashboard:bound-value", {
                    bubbles: true,
                    detail: { kind: this.getAttribute("kind"), value: this.value },
                }),
            );
        }
    }
}
customElements.define("cms-dashboard-input", DashboardInput);
