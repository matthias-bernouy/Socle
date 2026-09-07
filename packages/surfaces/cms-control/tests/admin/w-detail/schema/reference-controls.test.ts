import { afterEach, expect, test } from "bun:test";
import { mountDetailFields } from "../../dashboards/detail/boundDetail";

const originalFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = originalFetch;
    document.body.replaceChildren();
});

test("reference controls reuse credentials and published-only page selection without external or media tabs", async () => {
    const requests: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
        requests.push(String(url));
        return Response.json([{ path: "/terms", title: "Terms" }]);
    }) as typeof fetch;
    const detail = await mountDetailFields(
        [
            { id: "page", label: "Legal page", path: "page", type: "page-link", publishedOnly: true },
            {
                id: "signing",
                label: "Signing",
                path: "signing",
                type: "reorderable-list",
                itemKey: "id",
                fields: [{ id: "key", label: "Signing key", path: "signing.key", type: "secret-ref" }],
            },
        ],
        { page: "/terms", signing: [{ id: "service", signing: { key: "${SIGNING_KEY}" } }] },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests).toEqual(["/api/page/links?visible=published"]);
    const page = detail.querySelector("[data-field-control=page]")!;
    expect(page.getAttribute("allow-external")).toBe("false");
    expect(page.getAttribute("allow-media")).toBe("false");
    expect(detail.currentFieldValues().page).toBe("/terms");
    const secret = detail.querySelector<HTMLElement & { value: string }>("[data-item-field=key]")!;
    expect(secret.localName).toBe("cms-credential-select");
    expect(secret.value).toBe("${SIGNING_KEY}");
    expect(secret.shadowRoot?.textContent).not.toContain("a-secret-value");
});
