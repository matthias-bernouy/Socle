import { Component } from "@bernouy/components/base";
import { readWithdrawalCopy, withdrawalCopy } from "../copy";
import { downloadReceipt, isRecord, newIdempotencyKey, submissionError, syncReceipt } from "./receipt";

let formSequence = 0;
const reloadEvent = "mossa-service-withdrawal:reload";

export class ServiceWithdrawalForm extends Component {
    static observedAttributes = [
        ...Object.keys(withdrawalCopy),
        "locale",
        "order-param",
        "service-scope",
        "error-title",
        "error-message",
        "empty-message",
        "retry-label",
    ];

    private observer: MutationObserver | null = null;
    private receipt: Record<string, unknown> | null = null;
    private readonly formId = `mossa-service-withdrawal-${++formSequence}`;

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("click", this.onClick);
        this.addEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.addEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
        this.observer = new Observer(() => queueMicrotask(() => this.sync()));
        this.observer.observe(this, { childList: true, subtree: true });
        this.sync();
    }

    disconnectedCallback(): void {
        this.removeEventListener("click", this.onClick);
        this.removeEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.removeEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        this.observer?.disconnect();
        this.observer = null;
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            queueMicrotask(() => this.sync());
        }
    }

    private sync(): void {
        const form = this.form;
        setAttribute(form, "id", this.formId);
        setAttribute(
            form,
            "cms-source",
            "/.cms/sources/commerce/submitMyMarketplaceServiceWithdrawalRequest as withdrawal",
        );
        setAttribute(
            form,
            "cms-source-body",
            JSON.stringify({
                confirmed: { from: "raw", value: true },
                serviceScope: {
                    from: "raw",
                    value: this.getAttribute("service-scope")?.trim() || "marketplace_service",
                },
            }),
        );
        for (const control of this.querySelectorAll("[data-withdrawal-control]")) {
            setAttribute(control, "form", this.formId);
        }
        this.ensureIdempotencyKey();
        this.syncRenderedContent();
    }

    private syncRenderedContent(): void {
        for (const [attribute, fallback] of Object.entries(withdrawalCopy)) {
            for (const element of this.querySelectorAll<HTMLElement>(`[data-withdrawal-copy="${attribute}"]`)) {
                const value = this.copy(attribute) || fallback;
                const targetAttribute = element.dataset.withdrawalCopyAttribute;
                if (targetAttribute) {
                    setAttribute(element, targetAttribute, value);
                } else if (element.textContent !== value) {
                    element.textContent = value;
                }
            }
        }
        setText(this.querySelector("[data-error-title]"), this.text("error-title", "Request unavailable"));
        setText(
            this.querySelector("[data-error-message]"),
            this.text("error-message", "Your orders could not be loaded. Sign in and try again."),
        );
        setText(
            this.querySelector("[data-empty-message]"),
            this.text("empty-message", "No order is available on this account."),
        );
        setText(this.querySelector("[data-retry]"), this.text("retry-label", "Try again"));
        setAttribute(this.querySelector("[data-reason]"), "label", this.copy("reason-label"));
        setAttribute(this.querySelector("[data-reason]"), "placeholder", this.copy("reason-placeholder"));
        for (const option of this.querySelectorAll<HTMLElement>("[data-order-option]")) {
            const reference =
                option.dataset.orderNumber ||
                option.dataset.publicId ||
                this.copy("order-reference-label", { reference: option.dataset.orderId || "" });
            const title = option.dataset.firstTitle?.trim() || "";
            const label = title ? `${reference} — ${title}` : reference;
            if (option.textContent !== label) {
                option.textContent = label;
            }
        }
        this.selectRequestedOrder();
        syncReceipt(this, this.receipt, this.copy, this.locale);
    }

    private selectRequestedOrder(): void {
        const select = this.querySelector<HTMLElement & { value: string }>("[data-order]");
        const href = this.ownerDocument.defaultView?.location.href || "http://localhost/";
        const requested = new URL(href).searchParams.get(this.getAttribute("order-param")?.trim() || "orderId");
        const hasRequestedOrder = [...this.querySelectorAll("[data-order-option]")].some(
            (option) => option.getAttribute("value") === requested,
        );
        if (select && requested && hasRequestedOrder) {
            select.value = requested;
        }
    }

    private ensureIdempotencyKey(): void {
        const input = this.querySelector<HTMLInputElement>("[data-idempotency-key]");
        if (input && !input.value) {
            input.value = newIdempotencyKey();
            input.defaultValue = input.value;
        }
    }

    private onSourceSuccess = (event: CustomEvent<{ body?: unknown }>): void => {
        if (event.target !== this.form || !isRecord(event.detail?.body)) {
            return;
        }
        this.receipt = event.detail.body;
        this.querySelector<HTMLElement>("[data-form-card]")?.toggleAttribute("hidden", true);
        queueMicrotask(() => {
            const input = this.querySelector<HTMLInputElement>("[data-idempotency-key]");
            if (input) {
                input.value = "";
            }
            this.ensureIdempotencyKey();
            this.syncRenderedContent();
        });
    };

    private onSourceFailed = (event: CustomEvent<{ message?: string }>): void => {
        if (event.target === this.form) {
            setText(this.querySelector("[data-submit-error]"), submissionError(event.detail?.message, this.copy));
        }
    };

    private onClick = (event: Event): void => {
        const target = event.target instanceof Element ? event.target.closest("[data-retry], [data-download]") : null;
        if (target?.matches("[data-retry]")) {
            this.ownerDocument.dispatchEvent(new Event(reloadEvent));
        } else if (target?.matches("[data-download]")) {
            this.downloadReceipt();
        }
    };

    private downloadReceipt(): void {
        if (!this.receipt) {
            return;
        }
        downloadReceipt(this.ownerDocument, this.receipt, this.copy, this.locale);
    }

    private copy = (name: string, values: Record<string, string> = {}): string =>
        readWithdrawalCopy(this, name, values);
    private text(name: string, fallback: string): string {
        return this.getAttribute(name)?.trim() || fallback;
    }
    private get form(): HTMLFormElement | null {
        return this.querySelector("[data-withdrawal-form]");
    }
    private get locale(): string {
        return this.getAttribute("locale")?.trim() || "en-US";
    }
}

function setText(element: Element | null, value: unknown): void {
    const text = String(value ?? "—");
    if (element && element.textContent !== text) {
        element.textContent = text;
    }
}

function setAttribute(element: Element | null, name: string, value: string): void {
    if (element && element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", ServiceWithdrawalForm);
