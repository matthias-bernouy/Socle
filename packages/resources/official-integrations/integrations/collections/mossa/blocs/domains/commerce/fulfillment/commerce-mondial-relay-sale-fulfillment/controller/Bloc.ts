import { Component } from "@bernouy/components/base";
import { errorMessage, fulfillmentCopy, isRecord, safeCmsLabelUrl } from "../helpers";
import { renderFulfillment, syncFulfillmentPresentation } from "../presentation";

type RecordValue = Record<string, any>;

export class CommerceMondialRelaySaleFulfillment extends Component {
    static observedAttributes = [
        ...Object.keys(fulfillmentCopy),
        "order-id",
        "order-param",
        "title",
        "copy",
        "create-label",
        "retry-label",
        "tracking-label",
        "label-label",
        "redownload-label",
        "handoff-label",
        "error-title",
        "error-message",
        "missing-order-message",
    ];

    projection: RecordValue | null = null;
    lastErrorMessage = "";

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.addEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        this.syncPresentation();
        this.load();
    }

    disconnectedCallback(): void {
        this.removeEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.removeEventListener("cms-source:failed", this.onSourceFailed as EventListener);
    }

    attributeChangedCallback(name: string, previous: string | null, current: string | null): void {
        if (!this.isConnected) {
            return;
        }
        this.syncPresentation();
        if ((name === "order-id" || name === "order-param") && previous !== current) {
            this.load();
        }
    }

    load(): void {
        this.show("loading");
        if (!this.orderId) {
            this.fail(new Error(this.text("missing-order-message", "The sale identifier is missing.")));
            return;
        }
        this.projection = null;
        this.setOrderInputs();
        this.submit(this.source("shipment"));
    }

    render(result: RecordValue, shipment: RecordValue | null): void {
        renderFulfillment(this, result, shipment);
    }

    showProjection(result: RecordValue, shipment: RecordValue | null): void {
        this.projection = { ...result, shipments: shipment ? [shipment] : [] };
        this.render(this.projection, shipment);
        this.show("content");
    }

    showMutation(result: RecordValue): void {
        if (!this.projection) {
            this.load();
            return;
        }
        const returnedShipment = isRecord(result.shipment) ? result.shipment : null;
        if (!returnedShipment) {
            this.setStatus(this.text("action-error-message", errorMessage()), true);
            return;
        }
        const current =
            Array.isArray(this.projection.shipments) && isRecord(this.projection.shipments[0])
                ? this.projection.shipments[0]
                : {};
        const projection = {
            ...this.projection,
            ...(result.orderId !== undefined ? { orderId: result.orderId } : {}),
            ...(result.orderPublicId !== undefined ? { orderPublicId: result.orderPublicId } : {}),
        };
        this.showProjection(projection, { ...current, ...returnedShipment });
    }

    syncPresentation(): void {
        syncFulfillmentPresentation(this);
    }

    fail(error: unknown): void {
        const missingOrderMessage = !this.orderId && this.getAttribute("missing-order-message")?.trim();
        this.lastErrorMessage =
            missingOrderMessage || this.getAttribute("error-message")?.trim() || errorMessage(error);
        this.syncPresentation();
        this.show("error");
    }

    setStatus(message: string, error: boolean): void {
        this.message.textContent = message;
        this.message.toggleAttribute("data-error", error);
    }

    show(state: "loading" | "content" | "error"): void {
        this.loading.hidden = state !== "loading";
        this.content.hidden = state !== "content";
        this.error.hidden = state !== "error";
    }

    text(attribute: string, fallback: string): string {
        return this.getAttribute(attribute)?.trim() || fallback;
    }

    private onSourceSuccess = (event: CustomEvent<{ body?: unknown }>): void => {
        const result = record(event.detail?.body);
        if (!result) {
            this.onSourceFailed(event);
            return;
        }
        if (event.target === this.source("shipment")) {
            const shipments = Array.isArray(result.shipments) ? result.shipments : [];
            this.showProjection(result, isRecord(shipments[0]) ? shipments[0] : null);
        } else if (event.target === this.source("create") || event.target === this.source("handoff")) {
            this.showMutation(result);
            if (event.target === this.source("handoff")) {
                this.dispatchEvent(
                    new CustomEvent("commerce-fulfillment:updated", {
                        bubbles: true,
                        composed: true,
                        detail: { status: "seller_handoff_declared" },
                    }),
                );
            }
        } else if (event.target === this.source("label")) {
            this.openLabel(result.labelUrl);
        }
    };

    private onSourceFailed = (event: Event): void => {
        if (event.target === this.source("shipment")) {
            this.fail(event);
        } else if (
            event.target === this.source("create") ||
            event.target === this.source("handoff") ||
            event.target === this.source("label")
        ) {
            this.setStatus(this.text("action-error-message", errorMessage(event)), true);
        }
    };

    private openLabel(value: unknown): void {
        const origin = this.ownerDocument.defaultView?.location.origin || "http://localhost";
        const labelUrl = safeCmsLabelUrl(value, origin);
        if (!labelUrl) {
            this.setStatus(this.text("action-error-message", errorMessage()), true);
            return;
        }
        const link = this.ownerDocument.createElement("a");
        link.href = labelUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.hidden = true;
        this.append(link);
        link.click();
        link.remove();
    }

    private setOrderInputs(): void {
        for (const input of this.querySelectorAll<HTMLInputElement>("[data-order-id-input]")) {
            input.value = this.orderId;
        }
    }

    private submit(source: HTMLFormElement | null): void {
        if (source) {
            queueMicrotask(() => source.isConnected && source.requestSubmit());
        }
    }

    private source(name: string): HTMLFormElement | null {
        return this.querySelector<HTMLFormElement>(`[data-${name}-source]`);
    }

    get orderId(): string {
        const href = this.ownerDocument.defaultView?.location.href || "http://localhost/";
        return (
            this.getAttribute("order-id")?.trim() ||
            new URL(href).searchParams.get(this.getAttribute("order-param") || "orderId") ||
            ""
        );
    }

    get root(): HTMLElement {
        return this;
    }
    get loading(): HTMLElement {
        return this.querySelector("[data-loading]")!;
    }
    get content(): HTMLElement {
        return this.querySelector("[data-content]")!;
    }
    get error(): HTMLElement {
        return this.querySelector("[data-error]")!;
    }
    get errorMessage(): HTMLElement {
        return this.querySelector("[data-error-message]")!;
    }
    get titleElement(): HTMLElement {
        return this.querySelector("[data-title]")!;
    }
    get copyElement(): HTMLElement {
        return this.querySelector("[data-copy]")!;
    }
    get orderNumber(): HTMLElement {
        return this.querySelector("[data-order-number]")!;
    }
    get status(): HTMLElement {
        return this.querySelector("[data-status]")!;
    }
    get expedition(): HTMLElement {
        return this.querySelector("[data-expedition]")!;
    }
    get latest(): HTMLElement {
        return this.querySelector("[data-latest]")!;
    }
    get createButton(): HTMLElement {
        return this.querySelector("[data-create]")!;
    }
    get labelButton(): HTMLElement {
        return this.querySelector("[data-label]")!;
    }
    get handoffButton(): HTMLElement {
        return this.querySelector("[data-handoff]")!;
    }
    get trackingLink(): HTMLAnchorElement {
        return this.querySelector("[data-tracking-link]")!;
    }
    get message(): HTMLElement {
        return this.querySelector("[data-message]")!;
    }
}

function record(value: unknown): RecordValue | null {
    return isRecord(value) ? (value as RecordValue) : null;
}

customElements.define("BE5_TAG_TO_BE_REPLACED", CommerceMondialRelaySaleFulfillment);
