import {
    conditionLabel,
    formatDate,
    formatMoney,
    platformShippingShareAmount,
    salePresentationStatus,
    sellerCommissionAmount,
    sellerMerchandiseAmount,
    sellerProceedsAmount,
    sellerShippingShareAmount,
    shippingAmount,
    variantLabel,
} from "./helpers";

type SaleHost = HTMLElement & {
    locale: string;
    statusLabel(status: string): string;
    text(name: string, fallback: string): string;
};

export function syncSalePresentation(host: SaleHost): void {
    const summary = host.querySelector<HTMLElement>("[data-sale-summary]");
    if (!summary) {
        return;
    }
    const order = readOrder(summary);
    const currency = String(summary.dataset.financialCurrency || summary.dataset.currency || "USD");
    const reference =
        summary.dataset.orderNumber || summary.dataset.publicId || `Sale ${summary.dataset.orderId || ""}`;
    setText(host.querySelector("[data-order-number]"), reference);
    setText(
        host.querySelector("[data-order-date]"),
        `${host.text("date-prefix", "Sold on")} ${formatDate(summary.dataset.createdAt, host.locale)}`,
    );
    const status = salePresentationStatus(order);
    const badge = host.querySelector("[data-order-status]");
    setText(badge, host.statusLabel(status));
    badge?.setAttribute("tone", statusTone(status));
    setText(host.querySelector("[data-subtotal]"), formatMoney(sellerMerchandiseAmount(order), currency, host.locale));
    const commission = sellerCommissionAmount(order);
    setText(
        host.querySelector("[data-commission]"),
        formatMoney(commission === 0 ? 0 : -commission, currency, host.locale),
    );
    setText(host.querySelector("[data-shipping]"), sellerShippingValue(host, order, currency));
    setText(host.querySelector("[data-total]"), formatMoney(sellerProceedsAmount(order), currency, host.locale));
    for (const line of host.querySelectorAll<HTMLElement>("[data-sale-line]")) {
        syncLine(host, line, currency);
    }
}

function readOrder(element: HTMLElement): Record<string, unknown> {
    return {
        status: element.dataset.status,
        fulfillmentStatus: element.dataset.fulfillmentStatus,
        subtotalAmount: integer(element.dataset.subtotalAmount),
        shippingAmount: integer(element.dataset.shippingAmount),
        financialTerms: {
            merchandiseSubtotalAmount: integer(element.dataset.merchandiseSubtotalAmount),
            sellerCommissionAmount: integer(element.dataset.sellerCommissionAmount),
            sellerProceedsAmount: integer(element.dataset.sellerProceedsAmount),
            sellerShippingShareAmount: integer(element.dataset.sellerShippingShareAmount),
            platformShippingShareAmount: integer(element.dataset.platformShippingShareAmount),
            shippingAmount: integer(element.dataset.financialShippingAmount),
        },
    };
}

function syncLine(host: SaleHost, line: HTMLElement, currency: string): void {
    setText(
        line.querySelector("[data-line-title]"),
        line.dataset.title || line.dataset.snapshotTitle || host.text("fallback-article-label", "Item"),
    );
    const options = [...line.querySelectorAll<HTMLElement>("[data-variant-option]")].map((option) => ({
        axisKey: option.dataset.axisKey,
        axisLabel: option.dataset.axisLabel,
        valueKey: option.dataset.valueKey,
        valueLabel: option.dataset.valueLabel,
    }));
    const details = [
        variantLabel({ title: line.dataset.variantTitle, options }),
        integer(line.dataset.quantity) > 1
            ? `${host.text("quantity-label", "Quantity")} : ${line.dataset.quantity}`
            : "",
        line.dataset.conditionLabel || conditionLabel(line.dataset.conditionCode),
    ].filter(Boolean);
    const meta = line.querySelector<HTMLElement>("[data-line-meta]");
    setText(meta, details.join(" · "));
    meta?.toggleAttribute("hidden", details.length === 0);
    setText(
        line.querySelector("[data-line-price]"),
        formatMoney(integer(line.dataset.totalAmount), currency, host.locale),
    );
}

function sellerShippingValue(host: SaleHost, order: Record<string, unknown>, currency: string): string {
    const total = shippingAmount(order);
    const sellerShare = sellerShippingShareAmount(order);
    const platformShare = platformShippingShareAmount(order);
    if (![total, sellerShare, platformShare].every(Number.isSafeInteger) || sellerShare + platformShare !== total) {
        return "—";
    }
    if (sellerShare > 0) {
        return formatMoney(sellerShare, currency, host.locale, "always");
    }
    if (total === 0) {
        return formatMoney(0, currency, host.locale);
    }
    return platformShare === total ? host.text("platform-shipping-label", "Covered by the platform") : "—";
}

function statusTone(status: string): string {
    if (["completed", "collected_by_recipient"].includes(status)) {
        return "success";
    }
    if (["cancelled", "expired", "incident", "lost"].includes(status)) {
        return "danger";
    }
    if (["awaiting_quote", "awaiting_payment", "manual_review", "cancellation_pending"].includes(status)) {
        return "warning";
    }
    return "primary";
}

function integer(value: unknown): number {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function setText(element: Element | null, value: unknown): void {
    const text = String(value ?? "—");
    if (element && element.textContent !== text) {
        element.textContent = text;
    }
}
