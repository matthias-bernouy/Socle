import { expect, test } from "bun:test";
import { mountOffer } from "../commerce/catalogue/public-offer/harness";

test("public offer copy remains editable in the expanded Light DOM composition", async () => {
    const { host, requests, dispose } = await mountOffer();
    try {
        host.setAttribute("model-label", "Product model");
        host.setAttribute("secure-payment-label", "Protected payment");
        host.setAttribute("buyer-protection-label", "Protected purchase");
        host.setAttribute("tracked-delivery-label", "Shipment tracking");

        expect(host.querySelector("[data-secure-payment-label]")?.textContent).toBe("Protected payment");
        expect(host.querySelector("[data-buyer-protection-label]")?.textContent).toBe("Protected purchase");
        expect(host.querySelector("[data-tracked-delivery-label]")?.textContent).toBe("Shipment tracking");
        expect(host.querySelector("[data-specifications]")?.textContent).toContain("Product model");

        host.setAttribute("secure-payment-label", "Secure transaction");
        host.removeAttribute("buyer-protection-label");
        expect(host.querySelector("[data-secure-payment-label]")?.textContent).toBe("Secure transaction");
        expect(host.querySelector("[data-buyer-protection-label]")?.textContent).toBe("Buyer protection");
        expect(requests).toHaveLength(3);
    } finally {
        dispose();
    }
});
