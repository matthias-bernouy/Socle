import { purchaseText } from "./copy";

export function syncPurchaseItems(host: HTMLElement): void {
    for (const item of host.querySelectorAll<HTMLElement>("[data-purchase-item]")) {
        syncIdentity(host, item);
        syncStatus(host, item);
        syncAmount(host, item);
        syncLink(host, item);
    }
}

function syncIdentity(host: HTMLElement, item: HTMLElement): void {
    const id = item.dataset.orderId || "";
    const reference = item.dataset.orderNumber || purchaseText(host, "order-reference-template", { id });
    const firstTitle = item.dataset.firstTitle?.trim() || "";
    const lineCount = Number(item.dataset.lineCount);
    const title =
        firstTitle && Number.isSafeInteger(lineCount) && lineCount > 1
            ? purchaseText(host, lineCount > 2 ? "other-items-template" : "other-item-template", {
                  title: firstTitle,
                  count: lineCount - 1,
              })
            : firstTitle || reference;
    setText(item.querySelector("[data-purchase-title]"), title);
    const date = formatDate(
        item.dataset.createdAt,
        host.getAttribute("locale"),
        purchaseText(host, "unknown-date-label"),
    );
    const placed = purchaseText(host, "placed-on-template", { date });
    setText(item.querySelector("[data-purchase-meta]"), firstTitle ? `${reference} · ${placed}` : placed);
}

function syncStatus(host: HTMLElement, item: HTMLElement): void {
    const status = orderStatus(item.dataset);
    const badge = item.querySelector("[data-purchase-status]");
    setText(badge, purchaseText(host, `label-${status.key}`));
    setAttribute(badge, "tone", status.tone);
}

function syncAmount(host: HTMLElement, item: HTMLElement): void {
    setText(item.querySelector("[data-total-label]"), purchaseText(host, "total-label"));
    setText(
        item.querySelector("[data-total-value]"),
        money(Number(item.dataset.totalAmount), item.dataset.currency, host.getAttribute("locale")),
    );
}

function syncLink(host: HTMLElement, item: HTMLElement): void {
    const wrapper = item.querySelector<HTMLElement>("[data-order-action]");
    const link = wrapper?.querySelector("a");
    const template = host.getAttribute("order-url")?.trim() || "";
    const id = item.dataset.orderId || "";
    wrapper?.toggleAttribute("hidden", !template || !id);
    setText(link, host.getAttribute("order-action-label")?.trim() || "View order");
    if (link && template && id) {
        link.setAttribute("href", template.replaceAll("{orderId}", encodeURIComponent(id)));
    } else {
        link?.removeAttribute("href");
    }
}

function orderStatus(data: DOMStringMap): { key: string; tone: string } {
    const settlement = String(data.settlementStatus || "").toLowerCase();
    const payment = String(data.paymentStatus || "").toLowerCase();
    const claim = String(data.claimStatus || "").toLowerCase();
    if (settlement === "manual_review" || settlement === "blocked") {
        return { key: "review-required", tone: "danger" };
    }
    if (claim && !["resolved_buyer", "resolved_seller", "resolved_split"].includes(claim)) {
        return { key: "dispute-in-progress", tone: "warning" };
    }
    if (["refund_pending", "reversal_pending"].includes(settlement)) {
        return { key: "refund-in-progress", tone: "warning" };
    }
    if (settlement === "refunded" || settlement === "reversed" || payment === "refunded") {
        return { key: "refunded", tone: "neutral" };
    }
    if (payment === "partially_refunded") {
        return { key: "partially-refunded", tone: "neutral" };
    }
    if (["failed", "cancelled", "canceled"].includes(payment)) {
        return { key: payment === "failed" ? "payment-failed" : "payment-cancelled", tone: "danger" };
    }
    if (["created", "requires_action", "requires_payment_method", "processing"].includes(payment)) {
        return { key: "payment-pending", tone: "warning" };
    }
    return statusPresentation[data.orderStatus || ""] || { key: "unavailable", tone: "neutral" };
}

const statusPresentation: Record<string, { key: string; tone: string }> = {
    awaiting_quote: { key: "awaiting_quote", tone: "warning" },
    awaiting_payment: { key: "awaiting_payment", tone: "warning" },
    active: { key: "active", tone: "primary" },
    completed: { key: "completed", tone: "success" },
    expired: { key: "expired", tone: "neutral" },
    cancellation_pending: { key: "cancellation_pending", tone: "warning" },
    cancelled: { key: "cancelled", tone: "danger" },
};

function money(amount: number, currency: unknown, locale: string | null): string {
    if (!Number.isSafeInteger(amount)) {
        return "—";
    }
    try {
        return new Intl.NumberFormat(locale || "en-US", {
            style: "currency",
            currency: String(currency || "USD").toUpperCase(),
        }).format(amount / 100);
    } catch {
        return "—";
    }
}

function formatDate(value: unknown, locale: string | null, fallback: string): string {
    const parsed = new Date(String(value || ""));
    return Number.isNaN(parsed.getTime())
        ? fallback
        : new Intl.DateTimeFormat(locale || "en-US", { dateStyle: "long" }).format(parsed);
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
