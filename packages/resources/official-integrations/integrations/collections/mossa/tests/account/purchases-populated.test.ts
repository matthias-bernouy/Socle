import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OFFICIAL_INTEGRATIONS_ROOT } from "@bernouy/cms-official-integrations";
import { syncPurchaseItems } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/account/orders/purchases/presentation.ts";

afterEach(() => {
    document.body.replaceChildren();
    window.history.replaceState(null, "", "/");
});

test("formats bound purchases and translates pagination into a source offset", async () => {
    const list = document.createElement("div");
    for (const [name, value] of Object.entries({
        "page-size": "1",
        "order-url": "/order?id={orderId}",
        "order-action-label": "Open purchase",
        "placed-on-template": "Purchased {date}",
        "order-reference-template": "Purchase {id}",
        "other-items-template": "{title} with {count} more products",
        "total-label": "Amount paid",
        "label-active": "Preparing delivery",
        "pagination-previous-label": "Earlier",
        "pagination-next-label": "Later",
    })) {
        list.setAttribute(name, value);
    }
    list.innerHTML = `
        <input data-pagination-page type="hidden">
        <section data-purchases-source>
            <article
                data-purchase-item
                data-order-id="42"
                data-first-title="Demo racket"
                data-line-count="3"
                data-created-at="2026-09-06T12:00:00Z"
                data-order-status="active"
                data-total-amount="4000"
                data-currency="eur"
            >
                <strong data-purchase-title></strong>
                <small data-purchase-meta></small>
                <mossa-badge data-purchase-status></mossa-badge>
                <span data-total-label></span>
                <strong data-total-value></strong>
                <mossa-button data-order-action><a></a></mossa-button>
            </article>
            <mossa-pagination data-pagination total="2"></mossa-pagination>
        </section>`;
    syncPurchaseItems(list);

    expect(list.querySelector("[data-purchase-title]")?.textContent).toBe("Demo racket with 2 more products");
    expect(list.querySelector("[data-purchase-meta]")?.textContent).toBe("Purchase 42 · Purchased September 6, 2026");
    expect(list.querySelector("[data-purchase-status]")?.textContent).toBe("Preparing delivery");
    expect(list.querySelector("[data-purchase-status]")?.getAttribute("tone")).toBe("primary");
    expect(list.querySelector("[data-total-label]")?.textContent).toBe("Amount paid");
    expect(list.querySelector("[data-total-value]")?.textContent).toBe("€40.00");
    expect(list.querySelector("a")?.getAttribute("href")).toBe("/order?id=42");
    expect(list.querySelector("a")?.textContent).toBe("Open purchase");

    const controller = readFileSync(
        resolve(
            OFFICIAL_INTEGRATIONS_ROOT,
            "collections/mossa/blocs/domains/account/orders/purchases/controller/Bloc.ts",
        ),
        "utf8",
    );
    expect(controller).toContain("mossa-pagination:change");
    expect(controller).toContain("(page - 1) * this.pageSize");
    expect(controller).not.toContain("fetch(");
});

test("operation state keeps precedence over the order state", () => {
    const states = [
        [{ settlementStatus: "blocked", claimStatus: "open" }, "review-required", "danger"],
        [{ claimStatus: "open", paymentStatus: "refunded" }, "dispute-in-progress", "warning"],
        [{ settlementStatus: "refund_pending" }, "refund-in-progress", "warning"],
        [{ paymentStatus: "refunded" }, "refunded", "neutral"],
        [{ paymentStatus: "partially_refunded" }, "partially-refunded", "neutral"],
        [{ paymentStatus: "failed" }, "payment-failed", "danger"],
        [{ paymentStatus: "processing" }, "payment-pending", "warning"],
    ] as const;
    const list = document.createElement("div");
    list.setAttribute("unknown-date-label", "Date unavailable");
    list.innerHTML = `<section data-purchases-source>${states
        .map(
            ([operation], index) => `<article
                data-purchase-item
                data-order-id="${index + 1}"
                data-created-at="invalid"
                data-order-status="active"
                data-settlement-status="${operation.settlementStatus || ""}"
                data-payment-status="${operation.paymentStatus || ""}"
                data-claim-status="${operation.claimStatus || ""}"
            ><small data-purchase-meta></small><mossa-badge data-purchase-status></mossa-badge></article>`,
        )
        .join("")}</section>`;
    for (const [, status] of states) {
        list.setAttribute(`label-${status}`, `Custom ${status}`);
    }
    syncPurchaseItems(list);

    const rows = [...list.querySelectorAll("[data-purchase-item]")];
    for (const [index, [, status, tone]] of states.entries()) {
        expect(rows[index]?.querySelector("[data-purchase-status]")?.textContent).toBe(`Custom ${status}`);
        expect(rows[index]?.querySelector("[data-purchase-status]")?.getAttribute("tone")).toBe(tone);
        expect(rows[index]?.querySelector("[data-purchase-meta]")?.textContent).toBe("Placed on Date unavailable");
    }
});
