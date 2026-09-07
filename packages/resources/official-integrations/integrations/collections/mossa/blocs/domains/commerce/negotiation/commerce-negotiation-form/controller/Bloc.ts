import { Component } from "@bernouy/components/base";
import {
    formatMoney,
    minorUnits,
    negotiationCopy,
    positiveInteger,
    readPolicy,
    readProposal,
    syncFormCopy,
    syncPolicyPresentation,
    type Proposal,
} from "../presentation";

export class CommerceNegotiationForm extends Component {
    static observedAttributes = [
        ...Object.keys(negotiationCopy),
        "appearance",
        "copy",
        "density",
        "locale",
        "offer-id",
        "show-message",
        "unavailable-message",
    ];

    private observer: MutationObserver | null = null;
    private submittedProposal: Proposal | null = null;
    private currentOfferId: number | null = null;

    constructor() {
        super({ css: ":host { display: contents; }", template: "<slot></slot>" });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("submit", this.onSubmit, true);
        this.addEventListener("cms-source:success", this.onSourceSuccess as EventListener);
        this.addEventListener("cms-source:failed", this.onSourceFailed as EventListener);
        const Observer = this.ownerDocument.defaultView?.MutationObserver ?? MutationObserver;
        this.observer = new Observer(() => queueMicrotask(() => this.syncPresentation()));
        this.observer.observe(this, { childList: true, subtree: true });
        this.sync();
    }

    disconnectedCallback(): void {
        this.removeEventListener("submit", this.onSubmit, true);
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
        const offerId = positiveInteger(this.getAttribute("offer-id"));
        const offerChanged = offerId !== this.currentOfferId;
        if (offerChanged) {
            this.currentOfferId = offerId;
            this.submittedProposal = null;
            this.querySelector<HTMLElement>("[data-toast-region]")?.toggleAttribute("hidden", true);
        }
        if (offerId) {
            setAttribute(
                this.querySelector("[data-policy-source]"),
                "cms-source",
                `${policyEndpoint}?offerId=${offerId}`,
            );
            setAttribute(
                this.querySelector("[data-proposals-source]"),
                "cms-source",
                `${proposalsEndpoint}?role=buyer&status=pending&offerId=${offerId}&limit=1`,
            );
            const input = this.querySelector<HTMLInputElement>("[data-offer-id]");
            if (input) {
                input.value = String(offerId);
            }
        } else {
            const input = this.querySelector<HTMLInputElement>("[data-offer-id]");
            if (input) {
                input.value = "";
            }
        }
        if (offerChanged && !isFramed(this.ownerDocument.defaultView) && offerId) {
            this.show("loading");
            return;
        }
        this.syncPresentation();
    }

    private syncPresentation(): void {
        syncFormCopy(this, this.text);
        if (isFramed(this.ownerDocument.defaultView)) {
            syncPolicyPresentation(
                this,
                {
                    offerId: 1,
                    referenceAmount: 15_000,
                    minimumAmount: 12_000,
                    maximumAmount: 18_000,
                    currency: "usd",
                    wholeUnitPrices: false,
                },
                this.locale,
            );
            this.show("content");
            return;
        }
        const policyNode = this.querySelector<HTMLElement>("[data-policy-values]");
        const policy = readPolicy(policyNode);
        const offerId = positiveInteger(this.getAttribute("offer-id"));
        const sourceFailed = Boolean(this.querySelector("[data-policy-error], [data-proposals-error]"));
        const sourceLoading = Boolean(this.querySelector("[data-policy-loading], [data-proposals-loading]"));
        const eligible = policyNode?.dataset.enabled === "true" && policyNode.dataset.canPropose !== "false";
        const boundProposal = readProposal(this.querySelector("[data-existing-proposal]"));
        const existing =
            this.submittedProposal?.offerId === offerId
                ? this.submittedProposal
                : boundProposal?.offerId === offerId
                  ? boundProposal
                  : null;

        if (!offerId || sourceFailed || (policyNode && !eligible)) {
            this.show("unavailable");
            const ownOffer = policyNode?.dataset.ineligibilityReason === "own_offer";
            setText(
                this.querySelector("[data-unavailable]"),
                this.text(ownOffer ? "own-offer-message" : "unavailable", negotiationCopy.unavailable),
            );
            return;
        }
        if (!policy || policy.offerId !== offerId || sourceLoading || !this.querySelector("[data-proposals-loaded]")) {
            this.show("loading");
            return;
        }
        syncPolicyPresentation(this, policy, this.locale);
        if (existing) {
            const message = this.text("existing-message", negotiationCopy["existing-message"]);
            setText(
                this.querySelector("[data-existing]"),
                message.replaceAll(
                    "{amount}",
                    formatMoney(existing.proposedAmount, existing.currency, this.locale, policy.wholeUnitPrices),
                ),
            );
            this.show("existing");
        } else {
            this.show("content");
        }
    }

    private onSubmit = (event: Event): void => {
        const form =
            event.target instanceof HTMLFormElement && event.target.matches("[data-form]") ? event.target : null;
        const policy = readPolicy(this.querySelector("[data-policy-values]"));
        const amountInput = this.querySelector<HTMLInputElement & { value: string }>("[data-amount]");
        const amount = minorUnits(amountInput?.value);
        if (
            !form ||
            !policy ||
            !form.reportValidity() ||
            amount === null ||
            (policy.wholeUnitPrices && amount % 100 !== 0) ||
            amount < policy.minimumAmount ||
            amount > policy.maximumAmount
        ) {
            event.preventDefault();
            if (form) {
                event.stopImmediatePropagation();
                this.notice(this.text("error-message", "The proposed amount is invalid."), true);
                amountInput?.focus();
            }
            return;
        }
        const hidden = this.querySelector<HTMLInputElement>("[data-minor-amount]");
        if (hidden) {
            hidden.value = String(amount);
        }
    };

    private onSourceSuccess = (event: CustomEvent<{ body?: unknown }>): void => {
        if (event.target !== this.querySelector("[data-form]") || !isRecord(event.detail?.body)) {
            return;
        }
        const body = event.detail.body;
        const offerId = positiveInteger(body.offerId) || this.currentOfferId;
        const proposedAmount = Number(body.proposedAmount);
        const currency = String(body.currency || "");
        this.submittedProposal =
            offerId && Number.isSafeInteger(proposedAmount) && /^[a-z]{3}$/i.test(currency)
                ? { ...body, offerId, proposedAmount, currency }
                : null;
        this.notice(this.text("success-message", negotiationCopy["success-message"]), false);
        this.dispatchEvent(
            new CustomEvent("commerce-negotiation:created", { bubbles: true, composed: true, detail: body }),
        );
        this.syncPresentation();
    };

    private onSourceFailed = (event: CustomEvent<{ message?: string }>): void => {
        if (event.target === this.querySelector("[data-form]")) {
            this.notice(this.text("error-message", "Your proposal could not be submitted."), true);
        }
    };

    private notice(message: string, error: boolean): void {
        const toast = this.querySelector("[data-toast]");
        setText(toast, message);
        setAttribute(toast, "tone", error ? "danger" : "success");
        setAttribute(toast, "role", error ? "alert" : "status");
        this.querySelector<HTMLElement>("[data-toast-region]")?.toggleAttribute("hidden", false);
    }

    private show(state: "loading" | "content" | "existing" | "unavailable"): void {
        for (const name of ["loading", "content", "existing", "unavailable"] as const) {
            this.querySelector<HTMLElement>(`[data-${name}]`)?.toggleAttribute("hidden", name !== state);
        }
    }

    private text = (name: string, fallback: string): string => {
        return this.getAttribute(name === "unavailable" ? "unavailable-message" : name)?.trim() || fallback;
    };

    private get locale(): string {
        return this.getAttribute("locale")?.trim() || "en-US";
    }
}

const policyEndpoint = "/.cms/sources/system-functions/getProposalPolicy";
const proposalsEndpoint = "/.cms/sources/commerce-negotiation/myProposals";

function setText(element: Element | null, value: string): void {
    if (element && element.textContent !== value) {
        element.textContent = value;
    }
}

function setAttribute(element: Element | null, name: string, value: string): void {
    if (element && element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFramed(view: Window | null): boolean {
    try {
        return Boolean(view && view.self !== view.top);
    } catch {
        return true;
    }
}

customElements.define("BE5_TAG_TO_BE_REPLACED", CommerceNegotiationForm);
