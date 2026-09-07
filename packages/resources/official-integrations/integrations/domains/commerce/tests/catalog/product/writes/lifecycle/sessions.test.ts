import { describe, expect, test } from "bun:test";
import {
    capturedFetches,
    installCommerceTestEnvironment,
    jsonResponse,
    requestCommerce,
    setRestResponder,
} from "../../../../harness";
import { imageForm, pngBytes } from "../../../../selling/media/fixtures";
import { useProductResponder } from "../../fixtures";

installCommerceTestEnvironment();
const token = "11111111-1111-4111-8111-111111111111";

describe("product creation and private upload sessions", () => {
    test("reads fresh unpersisted defaults and an uncached creation token", async () => {
        const first = await requestCommerce("/admin/product");
        const second = await requestCommerce("/admin/product");
        const a = await first.json();
        const b = await second.json();
        expect(a).toMatchObject({ id: null, version: null, status: "draft", visibility: "hidden", media: [] });
        expect(a.creationToken).not.toBe(b.creationToken);
        expect(first.headers.get("cache-control")).toBe("private, no-store");
        expect(capturedFetches()).toEqual([]);
    });

    test("uses authenticated owner instead of body data and produces stable retry slugs", async () => {
        useProductResponder();
        const body = { title: "Created from form", creationToken: token, internalCmsUserId: "forged" };
        for (let i = 0; i < 2; i++) {
            const response = await requestCommerce("/admin/product", { body, userId: "admin-a", userRole: "admin" });
            expect(response.status).toBe(200);
        }
        const payloads = capturedFetches().map((call) => call.body.p_payload as Record<string, unknown>);
        expect(payloads[0]).toEqual(payloads[1]);
        expect(payloads[0]!.internalCmsUserId).toBe("admin-a");
        expect(payloads[0]!.slug).toBe(`created-from-form-${token}`);
    });

    test("rejects a session token without authenticated administrator context", async () => {
        for (const userRole of [null, "member"]) {
            const response = await requestCommerce(`/admin/product/image/stage?sessionId=${token}`, {
                userId: "admin-a",
                userRole,
                formData: imageForm(pngBytes()),
            });
            expect(response.status).toBe(403);
        }
        const missingUser = await requestCommerce(`/admin/product/image/stage?sessionId=${token}`, {
            userRole: "admin",
            formData: imageForm(pngBytes()),
        });
        expect(missingUser.status).toBe(401);
        expect(capturedFetches()).toEqual([]);
    });

    test("allocates the first session lazily and returns a signed common media descriptor", async () => {
        setRestResponder(async (request) => {
            const path = new URL(request.url).pathname;
            if (path.endsWith("/claim_product_media_cleanup")) {
                return jsonResponse({ items: [] });
            }
            if (path.endsWith("/stage_product_media")) {
                return jsonResponse({ media_id: 12 });
            }
            if (path.endsWith("/complete_product_media_upload")) {
                return jsonResponse({ ok: true });
            }
            if (path.includes("/object/sign/")) {
                return jsonResponse({ signedURL: "/object/sign/commerce-media/new.png?token=example" });
            }
            if (path.includes("/storage/v1/object/")) {
                return new Response(null, { status: 200 });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        const response = await requestCommerce("/admin/product/image/stage", {
            userId: "admin-a",
            userRole: "admin",
            formData: imageForm(pngBytes(), { filename: "new.png" }),
        });
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(typeof result.sessionId).toBe("string");
        expect(result).toMatchObject({
            media: {
                id: 12,
                name: "new.png",
                previewUrl: "https://project.supabase.co/storage/v1/object/sign/commerce-media/new.png?token=example",
            },
        });
        expect(capturedFetches()[1]!.body).toMatchObject({
            p_session_id: result.sessionId,
            p_owner_id: "admin-a",
            p_create_session: true,
        });
        expect(capturedFetches()[1]!.body.p_payload).toMatchObject({
            storagePath: expect.stringContaining(`upload-sessions/${result.sessionId}/`),
        });
    });
});
