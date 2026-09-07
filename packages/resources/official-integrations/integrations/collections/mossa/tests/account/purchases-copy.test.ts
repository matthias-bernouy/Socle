import { afterEach, describe, expect, test } from "bun:test";
import { syncPurchaseCopy } from "@bernouy/cms-official-integrations/integrations/mossa/blocs/domains/account/orders/purchases/copy.ts";

afterEach(() => document.body.replaceChildren());

describe("Purchase state copy", () => {
    test("updates authored state copy in Light DOM", async () => {
        const list = document.createElement("div");
        list.setAttribute("login-title", "Your purchase history requires a session");
        list.setAttribute("login-description", "Continue from your account");
        list.setAttribute("error-title", "History temporarily unavailable");
        list.setAttribute("empty-title", "Nothing purchased");
        list.innerHTML = `
            <section data-purchases-source>
                <mossa-skeleton data-loading></mossa-skeleton>
                <mossa-surface-card data-login><strong slot="title"></strong><span slot="description"></span></mossa-surface-card>
                <mossa-surface-card data-error><strong slot="title"></strong><span data-error-message></span></mossa-surface-card>
                <mossa-surface-card data-empty><strong slot="title"></strong><span slot="description"></span></mossa-surface-card>
                <mossa-pagination data-pagination></mossa-pagination>
            </section>`;
        syncPurchaseCopy(list);

        expect(list.querySelector("[data-login] [slot=title]")?.textContent).toBe(
            "Your purchase history requires a session",
        );
        expect(list.querySelector("[data-login] [slot=description]")?.textContent).toBe("Continue from your account");
        expect(list.querySelector("[data-error] [slot=title]")?.textContent).toBe("History temporarily unavailable");
        expect(list.querySelector("[data-empty] [slot=title]")?.textContent).toBe("Nothing purchased");

        list.setAttribute("loading-label", "Loading purchase history");
        list.setAttribute("pagination-label", "Browse purchase pages");
        list.removeAttribute("login-title");
        syncPurchaseCopy(list);
        expect(list.querySelector("[data-login] [slot=title]")?.textContent).toBe("Sign in to view your purchases");
        expect(list.querySelector("[data-loading]")?.getAttribute("label")).toBe("Loading purchase history");
        expect(list.querySelector("[data-pagination]")?.getAttribute("aria-label")).toBe("Browse purchase pages");
    });
});
