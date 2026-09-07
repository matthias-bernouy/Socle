import { setSourceData, mountDetail } from "./boundDetail";
import { afterEach, describe, expect, test } from "bun:test";
import { detailElement, sharedLookupWidget, singleLookupWidget } from "./detailLifecycleFixtures";
import { waitForDetail } from "./detailTestHelpers";

const realFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = realFetch;
    document.body.replaceChildren();
});

describe("dashboard detail request lifecycle", () => {
    test("waits for resolved bound data and shares equivalent lookup and schema requests", async () => {
        const requests: Request[] = [];
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            requests.push(
                new Request(input instanceof Request ? input : new URL(String(input), window.location.href), init),
            );
            return Response.json({
                items: [{ id: "brand-1", name: "Acme" }],
                fields: [{ id: "material", label: "Material", type: "string" }],
            });
        }) as unknown as typeof fetch;
        const detail = detailElement(sharedLookupWidget());
        setSourceData(detail, undefined);
        detail.setAttribute("data-source-id", "catalog");

        await Promise.resolve();
        expect(requests).toHaveLength(0);
        const core = document.createElement("cms-binding-core");
        core.append(detail);
        document.body.append(core);
        await Promise.resolve();
        expect(requests).toHaveLength(0);

        detail.setAttribute("data-row-key", "product-1");
        setSourceData(detail, {
            id: "product-1",
            categoryId: "category-1",
            brandId: "brand-1",
            secondaryBrandId: "brand-1",
        });
        await waitForDetail(() => Boolean(detail.querySelector("option[value='brand-1']")));
        await waitForDetail(() => Boolean(detail.querySelector("[data-schema-key='material']")));

        expect(requests).toHaveLength(1);
        expect(requests[0]?.url).toContain("categoryId=category-1");
    });

    test("does not render a stale response after the detail resource changes", async () => {
        const responses = new Map<string, (response: Response) => void>();
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const ownerId = new URL(String(input), window.location.href).searchParams.get("ownerId") ?? "";
            return new Promise<Response>((resolve) => responses.set(ownerId, resolve));
        }) as unknown as typeof fetch;
        const detail = detailElement(singleLookupWidget());
        detail.setAttribute("data-source-id", "catalog");
        detail.setAttribute("data-row-key", "product");
        setSourceData(detail, { id: "product-a", productId: "a" });
        await mountDetail(detail);
        await waitForDetail(() => responses.has("product-a"));

        setSourceData(detail, { id: "product-b", productId: "b" });
        await waitForDetail(() => responses.has("product-b"));
        responses.get("product-b")!(Response.json({ items: [{ id: "b", title: "Product B" }] }));
        await waitForDetail(() => Boolean(detail.querySelector("option[value='b']")));

        responses.get("product-a")!(Response.json({ items: [{ id: "a", title: "Product A" }] }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(detail.querySelector("option[value='a']")).toBeNull();
        expect(detail.querySelector("option[value='b']")?.textContent).toBe("Product B");
    });

    test("aborts and clears stale detail data when a resolved binding becomes invalid", async () => {
        let signal: AbortSignal | undefined;
        globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
            signal = init?.signal ?? undefined;
            return new Promise<Response>((_resolve, reject) => {
                signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
            });
        }) as unknown as typeof fetch;
        const detail = detailElement(singleLookupWidget());
        detail.setAttribute("data-source-id", "catalog");
        detail.setAttribute("data-row-key", "product-a");
        setSourceData(detail, { id: "product-a", title: "Private A", productId: "a" });
        await mountDetail(detail);
        await waitForDetail(() => signal !== undefined);
        expect(detail.textContent).toContain("Private A");

        setSourceData(detail, undefined);
        await waitForDetail(() => signal?.aborted === true);
        await Promise.resolve();

        expect(detail.textContent).not.toContain("Private A");
        expect(detail.querySelector("[data-field-control='productId']")).toBeNull();
    });

    test("does not load lookups when the configured resource path is absent", async () => {
        let requests = 0;
        globalThis.fetch = (async () => {
            requests += 1;
            return Response.json({ items: [] });
        }) as unknown as typeof fetch;
        const configured = singleLookupWidget();
        configured.source.itemPath = "item";
        const detail = detailElement(configured);
        detail.setAttribute("data-source-id", "catalog");
        setSourceData(detail, {});
        await mountDetail(detail);
        await Promise.resolve();

        expect(requests).toBe(0);
        expect(detail.querySelector("[data-field-control]")).toBeNull();
    });

    test("ignores a queued attribute sync across disconnect and reconnect", async () => {
        let requests = 0;
        globalThis.fetch = (async () => {
            requests += 1;
            return Response.json({ items: [] });
        }) as unknown as typeof fetch;
        const detail = detailElement(singleLookupWidget());
        detail.setAttribute("data-source-id", "catalog");
        detail.setAttribute("data-row-key", "product");
        setSourceData(detail, { id: "product-a", productId: "a" });
        await mountDetail(detail);
        await waitForDetail(() => requests === 1);

        setSourceData(detail, { id: "product-b", productId: "b" });
        const core = detail.parentElement!;
        detail.remove();
        await Promise.resolve();
        setSourceData(detail, { id: "product-b", productId: "b" });
        core.append(detail);
        await waitForDetail(() => requests === 2);
        await Promise.resolve();

        expect(requests).toBe(2);
    });
});
