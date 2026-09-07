import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { CheckoutFlow } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/commerce/checkout/checkout/Bloc.ts";
import { OrderDetail } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/account/orders/order/Bloc.ts";
import { readWithdrawalCopy } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/commerce/checkout/service-withdrawal/copy.ts";

const originalFetch = globalThis.fetch;
const tags = {
    checkout: "mossa-checkout-copy-test",
    order: "mossa-order-copy-test",
    withdrawal: "mossa-withdrawal-copy-test",
};

beforeAll(() => {
    customElements.define(tags.checkout, CheckoutFlow);
    customElements.define(tags.order, OrderDetail);
});
afterEach(() => {
    document.body.replaceChildren();
    globalThis.fetch = originalFetch;
    location.href = "http://localhost/";
});
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(tag: string, attributes: Record<string, string>, content = ""): HTMLElement {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
    }
    element.innerHTML = content;
    document.body.append(element);
    return element;
}
function errorText(element: HTMLElement): string {
    const error = element.shadowRoot!.querySelector<HTMLElement>("[data-error]")!;
    expect(error.hidden).toBe(false);
    return error.textContent || "";
}

describe("Checkout and order state copy", () => {
    test("renders authored missing-offer copy without starting an API request", async () => {
        location.href = "http://localhost/checkout";
        let requests = 0;
        globalThis.fetch = (async () => {
            requests++;
            return Response.json({});
        }) as typeof fetch;
        const checkout = mount(
            tags.checkout,
            { "error-title": "Choose an item", "missing-offer-message": "Return to the marketplace." },
            '<div slot="checkout-payment" data-checkout-payment></div>',
        );
        await settled();
        expect(errorText(checkout)).toContain("Choose an item");
        expect(errorText(checkout)).toContain("Return to the marketplace.");
        checkout.removeAttribute("error-title");
        expect(errorText(checkout)).toContain("Unable to continue");
        expect(requests).toBe(0);
    });

    test("renders configured order errors and retains the default when no copy is authored", async () => {
        location.href = "http://localhost/order";
        const order = mount(tags.order, {
            "error-title": "Your order is unavailable",
            "missing-order-message": "Choose an order from your purchases.",
        });
        await settled();
        expect(errorText(order)).toContain("Your order is unavailable");
        expect(errorText(order)).toContain("Choose an order from your purchases.");
        order.removeAttribute("error-title");
        expect(errorText(order)).toContain("Order not found");
    });

    test("keeps provider failure details private while using authored withdrawal error copy", async () => {
        const withdrawal = mount("div", {
            "error-title": "Sign in first",
            "error-message": "Order history requires a session.",
            "retry-label": "Reload orders",
        });
        expect(withdrawal.getAttribute("error-title")).toBe("Sign in first");
        expect(withdrawal.getAttribute("error-message")).toBe("Order history requires a session.");
        expect(withdrawal.getAttribute("retry-label")).toBe("Reload orders");
        expect(withdrawal.textContent).not.toContain("Internal provider details");
    });

    test("distinguishes an empty account from a failed withdrawal request", async () => {
        const withdrawal = mount("div", { "empty-message": "There are no orders to select." });
        expect(withdrawal.getAttribute("empty-message")).toBe("There are no orders to select.");
        expect(readWithdrawalCopy(withdrawal, "submit-error-message")).toBe(
            "The request could not be recorded. Try again shortly.",
        );
    });
});
