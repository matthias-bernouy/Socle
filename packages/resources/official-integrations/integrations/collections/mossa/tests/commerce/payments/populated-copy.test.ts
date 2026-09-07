import { afterEach, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { OrderDetail } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/account/orders/order/controller/Bloc.ts";
import { OFFICIAL_INTEGRATIONS_ROOT } from "@bernouy/cms-official-integrations";
import { readWithdrawalCopy } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/commerce/checkout/service-withdrawal/copy.ts";
import {
    receiptStatus,
    receiptText,
} from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/commerce/checkout/service-withdrawal/controller/receipt.ts";

const originalFetch = globalThis.fetch;
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
let orderMarkup = "";
beforeAll(async () => {
    customElements.define("test-populated-order-copy", class extends OrderDetail {});
    const source = await Bun.file(
        resolve(OFFICIAL_INTEGRATIONS_ROOT, "collections/mossa/blocs/domains/account/orders/order/template.html"),
    ).text();
    const template = document.createElement("template");
    template.innerHTML = source;
    orderMarkup = template.content.firstElementChild?.innerHTML ?? "";
});
afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
    location.href = "http://localhost/";
});
function mount(tag: string, attrs: Record<string, string>, content = ""): HTMLElement {
    const host = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => host.setAttribute(key, value));
    host.innerHTML = content;
    document.body.append(host);
    return host;
}

test("populated order copy updates without refetching or changing payment and delivery state", async () => {
    location.href = "http://localhost/order?orderId=7";
    let requests = 0;
    const host = document.createElement("test-populated-order-copy");
    for (const [key, value] of Object.entries({
        "state-in-delivery": "On the way",
        "order-date-label": "Created: {date}",
        "tracking-number-label": "Tracking {number}",
        "amount-pending-label": "Pending quote",
        "condition-good-label": "Great",
        "condition-label": "Grade {condition}",
    })) {
        host.setAttribute(key, value);
    }
    host.innerHTML = `${orderMarkup}<div slot="resume-action" data-resume-payment-action><a data-resume-payment></a></div><div slot="tracking-action" data-tracking-action><a data-tracking-link></a></div>`;
    for (const form of host.querySelectorAll<HTMLFormElement>("form[cms-source]")) {
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            requests++;
            let body: unknown = {};
            if (form.matches("[data-order-source]")) {
                body = {
                    id: 7,
                    publicId: "ABC",
                    status: "active",
                    createdAt: "2026-01-01",
                    currency: "EUR",
                    subtotalAmount: 5000,
                    lines: [{ title: "Racket", offerSnapshot: { conditionCode: "good" } }],
                };
            } else if (form.matches("[data-payment-source]")) {
                body = { payment: { paymentStatus: "succeeded" } };
            } else if (form.matches("[data-shipment-source]")) {
                body = { shipments: [{ status: "in_transit", expeditionNumber: "ZX123" }] };
            }
            queueMicrotask(() =>
                form.dispatchEvent(new CustomEvent("cms-source:success", { bubbles: true, detail: { body } })),
            );
        });
    }
    document.body.append(host);
    while (host.querySelector<HTMLElement>("[data-content]")?.hidden) {
        await settled();
    }
    const root = host;
    expect(root.querySelector<HTMLElement>("[data-content]")!.hidden).toBe(false);
    expect(root.querySelector("[data-order-status]")!.textContent).toBe("On the way");
    expect(root.querySelector<HTMLElement>("[data-order-status]")!.getAttribute("tone")).toBe("primary");
    expect(root.querySelector("[data-order-date]")!.textContent).toStartWith("Created:");
    expect(root.querySelector("[data-tracking-number]")!.textContent).toBe("Tracking ZX123");
    expect(root.querySelector("[data-shipping]")!.textContent).toBe("Pending quote");
    expect(root.querySelector("[data-line-condition]")!.textContent).toBe("Grade Great");
    expect(root.querySelector("[data-payment-confirmation]")!.textContent).toBe("Payment confirmed");
    host.setAttribute("state-payment-confirmed", "Funds received");
    host.removeAttribute("state-in-delivery");
    expect(root.querySelector("[data-payment-confirmation]")!.textContent).toBe("Funds received");
    expect(root.querySelector("[data-order-status]")!.textContent).toBe("In delivery");
    expect(requests).toBe(4);
});

test("withdrawal copy formats bound orders and receipt statuses", async () => {
    const host = mount("div", {
        "order-reference-label": "Purchase {reference}",
        "form-title": "Request service withdrawal",
        "status-submitted-label": "Registered",
    });
    const receipt = { publicId: "REQ-7", orderId: 7, status: "submitted", submittedAt: "2026-01-01" };
    expect(readWithdrawalCopy(host, "order-reference-label", { reference: "7" })).toBe("Purchase 7");
    expect(readWithdrawalCopy(host, "form-title")).toBe("Request service withdrawal");
    expect(receiptStatus(receipt.status, (name) => readWithdrawalCopy(host, name))).toBe("Registered");
    host.removeAttribute("status-submitted-label");
    expect(receiptStatus(receipt.status, (name) => readWithdrawalCopy(host, name))).toBe("Received");
    host.setAttribute("receipt-title", "Service request receipt");
    host.setAttribute("receipt-notice", "Recorded for review; no refund has been completed.");
    const content = receiptText(receipt, (name) => readWithdrawalCopy(host, name), "en-US");
    expect(content).toContain("Service request receipt");
    expect(content).toContain("Reference: REQ-7");
    expect(content).toContain("Status: Received");
    expect(content).toContain("Recorded for review; no refund has been completed.");
});
