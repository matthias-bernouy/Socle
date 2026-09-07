export type ProposalPolicy = {
    offerId: number;
    referenceAmount: number;
    minimumAmount: number;
    maximumAmount: number;
    currency: string;
    wholeUnitPrices: boolean;
};

export type Proposal = { offerId: number; proposedAmount: number; currency: string } & Record<string, unknown>;

export const negotiationCopy = {
    "amount-hint": "Enter an amount within the displayed range.",
    "amount-label": "Your price (€)",
    "button-label": "Submit my proposal",
    "current-label": "Current price",
    "error-message": "The terms for this offer could not be loaded.",
    "existing-message": "You already submitted a proposal of {amount} for this offer.",
    "message-hint": "You may explain your proposal.",
    "message-label": "Message to seller (optional)",
    "message-placeholder": "Hello, would you accept my proposal?",
    "own-offer-message": "You cannot submit a proposal on your own offer.",
    "range-label": "Allowed proposal",
    "success-message": "Your proposal was submitted.",
    title: "Make a proposal",
    unavailable: "This offer is not available for proposals.",
};

export function syncFormCopy(host: HTMLElement, text: (name: string, fallback: string) => string): void {
    setText(host.querySelector("[data-title]"), text("title", negotiationCopy.title));
    setText(
        host.querySelector("[data-copy]"),
        host.getAttribute("copy") || "Propose a price to the seller within the allowed range.",
    );
    for (const name of ["current-label", "range-label", "button-label"] as const) {
        setText(host.querySelector(`[data-${name}]`), text(name, negotiationCopy[name]));
    }
    setAttribute(host.querySelector("[data-card]"), "appearance", host.getAttribute("appearance") || "plain");
    setAttribute(host.querySelector("[data-card]"), "density", host.getAttribute("density") || "regular");
    const amount = host.querySelector("[data-amount]");
    setAttribute(amount, "label", text("amount-label", negotiationCopy["amount-label"]));
    setAttribute(amount, "hint", text("amount-hint", negotiationCopy["amount-hint"]));
    const message = host.querySelector("[data-message]");
    setAttribute(message, "label", text("message-label", negotiationCopy["message-label"]));
    setAttribute(message, "hint", text("message-hint", negotiationCopy["message-hint"]));
    setAttribute(message, "placeholder", text("message-placeholder", negotiationCopy["message-placeholder"]));
    const messageHidden = host.getAttribute("show-message") === "false";
    host.querySelector<HTMLElement>("[data-message-field]")?.toggleAttribute("hidden", messageHidden);
    message?.toggleAttribute("disabled", messageHidden);
}

export function syncPolicyPresentation(host: HTMLElement, policy: ProposalPolicy, locale: string): void {
    setText(
        host.querySelector("[data-current-price]"),
        formatMoney(policy.referenceAmount, policy.currency, locale, policy.wholeUnitPrices),
    );
    setText(
        host.querySelector("[data-range]"),
        `${formatMoney(policy.minimumAmount, policy.currency, locale, policy.wholeUnitPrices)} – ${formatMoney(policy.maximumAmount, policy.currency, locale, policy.wholeUnitPrices)}`,
    );
    const amount = host.querySelector("[data-amount]");
    setAttribute(amount, "min", decimalAmount(policy.minimumAmount, policy.wholeUnitPrices));
    setAttribute(amount, "max", decimalAmount(policy.maximumAmount, policy.wholeUnitPrices));
    setAttribute(amount, "step", policy.wholeUnitPrices ? "1" : "0.01");
}

export function readPolicy(element: HTMLElement | null): ProposalPolicy | null {
    if (!element) {
        return null;
    }
    const policy = {
        offerId: positiveInteger(element.dataset.offerId),
        referenceAmount: safeAmount(element.dataset.referenceAmount),
        minimumAmount: safeAmount(element.dataset.minimumAmount),
        maximumAmount: safeAmount(element.dataset.maximumAmount),
        currency: currency(element.dataset.currency),
        wholeUnitPrices: element.dataset.wholeUnitPrices === "true",
    };
    return policy.offerId &&
        policy.referenceAmount !== null &&
        policy.minimumAmount !== null &&
        policy.maximumAmount !== null &&
        policy.currency &&
        policy.minimumAmount <= policy.maximumAmount
        ? (policy as ProposalPolicy)
        : null;
}

export function readProposal(element: HTMLElement | null): Proposal | null {
    const offerId = positiveInteger(element?.dataset.offerId);
    const proposedAmount = safeAmount(element?.dataset.proposedAmount);
    const proposalCurrency = currency(element?.dataset.currency);
    return !offerId || proposedAmount === null || !proposalCurrency
        ? null
        : { offerId, proposedAmount, currency: proposalCurrency };
}

export function minorUnits(value: unknown): number | null {
    const text = String(value ?? "")
        .trim()
        .replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        return null;
    }
    const amount = Math.round(Number(text) * 100);
    return Number.isSafeInteger(amount) ? amount : null;
}

export function decimalAmount(value: number, wholeUnitPrices = false): string {
    return wholeUnitPrices ? String(value / 100) : (value / 100).toFixed(2);
}

export function formatMoney(amount: number, currencyCode: string, locale: string, wholeUnitPrices = false): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currencyCode.toUpperCase(),
            minimumFractionDigits: wholeUnitPrices ? 0 : undefined,
            maximumFractionDigits: wholeUnitPrices ? 0 : undefined,
        }).format(amount / 100);
    } catch {
        return `${decimalAmount(amount, wholeUnitPrices)} ${currencyCode.toUpperCase()}`;
    }
}

export function positiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeAmount(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function currency(value: unknown): string | null {
    const text = String(value || "");
    return /^[a-z]{3}$/i.test(text) ? text.toLowerCase() : null;
}

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
