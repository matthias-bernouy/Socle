import { describe, expect, test } from "bun:test";
import {
    capturedFetches,
    expectRpc,
    installCommerceTestEnvironment,
    jsonResponse,
    requestCommerce,
    setRestResponder,
} from "../../../../harness";

installCommerceTestEnvironment();

function respondWithProduct(): void {
    setRestResponder(() =>
        jsonResponse({
            state: "ok",
            product: { id: 42, version: 2 },
            public_metadata_keys: [],
            axes: [],
            values: [],
            variants: [],
            selections: [],
            media: [],
            brand: null,
            categories: [],
        }),
    );
}

describe("product detail form endpoint", () => {
    test("creates a private draft from its title and generates different valid slugs", async () => {
        respondWithProduct();
        const slugs: string[] = [];
        for (let index = 0; index < 2; index++) {
            const response = await requestCommerce("/admin/product", { body: { title: "Été Racket" } });
            expect(response.status).toBe(200);
            const payload = capturedFetches().at(-1)!.body.p_payload as Record<string, unknown>;
            expect(payload).toMatchObject({ title: "Été Racket", status: "draft", visibility: "hidden" });
            expect(payload.slug).toMatch(/^ete-racket-[a-f0-9-]+$/);
            slugs.push(String(payload.slug));
        }
        expect(slugs[0]).not.toBe(slugs[1]);
    });

    test("keeps a truncated generated slug within the database format", async () => {
        respondWithProduct();
        const response = await requestCommerce("/admin/product", { body: { title: `${"a".repeat(109)} tail` } });
        expect(response.status).toBe(200);
        const payload = capturedFetches()[0]!.body.p_payload as Record<string, unknown>;
        expect(payload.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(String(payload.slug).length).toBeLessThanOrEqual(160);
    });

    test("accepts identity in the actual form body, requires the revision and keeps ordered media", async () => {
        respondWithProduct();
        expect((await requestCommerce("/admin/product", { body: { id: 42, title: "Edit" } })).status).toBe(400);
        expect(capturedFetches()).toHaveLength(0);
        const response = await requestCommerce("/admin/product", {
            body: {
                id: 42,
                expectedVersion: 1,
                mediaIds: [7, 3],
                metadata: { weight: 0, obsolete: null },
                variantAxes: [{ label: "Size", values: "S,M" }],
            },
        });
        expect(response.status).toBe(200);
        expect(expectRpc("upsert_product_read_model").body).toMatchObject({
            p_product_id: 42,
            p_expected_version: 1,
            p_payload: {
                mediaIds: [7, 3],
                metadata: { weight: 0, obsolete: null },
                variantAxes: [{ values: [{ label: "S" }, { label: "M" }] }],
            },
        });
    });

    test("accepts a technical axis key and derives the server-owned identity marker", async () => {
        respondWithProduct();
        const response = await requestCommerce("/admin/product", {
            body: {
                id: 42,
                expectedVersion: 1,
                variantAxes: [{ key: "free-axis", values: "Old,Extra" }],
            },
        });
        expect(response.status).toBe(200);
        expect(expectRpc("upsert_product_read_model").body.p_payload).toMatchObject({
            variantAxesFromFields: true,
            variantAxes: [{ key: "free-axis", label: "free-axis" }],
        });
    });

    test("rejects conflicting identities before any write", async () => {
        const response = await requestCommerce("/admin/product?id=43", { body: { id: 42, expectedVersion: 1 } });
        expect(response.status).toBe(400);
        expect(capturedFetches()).toHaveLength(0);
    });
});
