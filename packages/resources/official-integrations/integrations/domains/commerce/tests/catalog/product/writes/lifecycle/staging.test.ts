import { describe, expect, test } from "bun:test";
import {
    capturedFetches,
    installCommerceTestEnvironment,
    jsonResponse,
    requestCommerce,
    setRestResponder,
} from "../../../../harness";
import { imageForm, pngBytes } from "../../../../selling/media/fixtures";

installCommerceTestEnvironment();
const session = "11111111-1111-4111-8111-111111111111";

function useStaging(options: { uploadFails?: boolean; cleanupFails?: boolean; signingFails?: boolean } = {}): void {
    setRestResponder(async (request) => {
        const name = new URL(request.url).pathname.split("/").at(-1);
        const body = request.url.includes("/rpc/") ? await request.json() : null;
        if (name === "claim_product_media_cleanup") {
            return jsonResponse({
                items: body.p_media_ids
                    ? [
                          {
                              sessionId: session,
                              mediaId: 5,
                              storageBucket: "commerce-media",
                              storagePath: `upload-sessions/${session}/pending.png`,
                          },
                      ]
                    : [],
            });
        }
        if (name === "stage_product_media") {
            return jsonResponse({ id: 5, media_id: 5, width: 1, height: 1 });
        }
        if (name === "complete_product_media_upload" || name === "finish_product_media_cleanup") {
            return jsonResponse({ ok: true });
        }
        if (request.url.includes("/storage/v1/object/sign/")) {
            return options.signingFails
                ? jsonResponse({ message: "unavailable" }, 503)
                : jsonResponse({ signedURL: "/object/sign/commerce-media/test?token=preview" });
        }
        if (request.url.includes("/storage/v1/object/")) {
            if (
                (request.method === "POST" && options.uploadFails) ||
                (request.method === "DELETE" && options.cleanupFails)
            ) {
                return jsonResponse({ message: "storage unavailable" }, 503);
            }
            return new Response(null, { status: 200 });
        }
        throw new Error(`Unexpected request: ${request.url}`);
    });
}

function callKinds(): string[] {
    return capturedFetches().map((call) =>
        call.url.includes("/storage/") ? `storage:${call.method}` : new URL(call.url).pathname.split("/").at(-1)!,
    );
}

describe("product staged image transport", () => {
    test("cleans up an uploaded image if preview signing fails before returning its session", async () => {
        useStaging({ signingFails: true });
        const response = await requestCommerce(`/admin/product/image/stage?sessionId=${session}`, {
            userId: "admin-a",
            userRole: "admin",
            formData: imageForm(pngBytes()),
        });
        expect(response.status).toBe(502);
        expect(callKinds()).toEqual([
            "claim_product_media_cleanup",
            "stage_product_media",
            "storage:POST",
            "storage:POST",
            "claim_product_media_cleanup",
            "storage:DELETE",
            "finish_product_media_cleanup",
        ]);
    });

    test("reserves, transfers, then marks ready without attaching or saving the product", async () => {
        useStaging();
        const response = await requestCommerce(`/admin/product/image/stage?sessionId=${session}`, {
            userId: "admin-a",
            userRole: "admin",
            formData: imageForm(pngBytes(), { filename: "racket.png", type: "image/png" }),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ sessionId: session, media: { id: 5 } });
        expect(callKinds()).toEqual([
            "claim_product_media_cleanup",
            "stage_product_media",
            "storage:POST",
            "storage:POST",
            "complete_product_media_upload",
        ]);
    });

    test("claims failed uploads before deleting through Storage and only then finishes cleanup", async () => {
        useStaging({ uploadFails: true });
        const response = await requestCommerce(`/admin/product/image/stage?sessionId=${session}`, {
            userId: "admin-a",
            userRole: "admin",
            formData: imageForm(pngBytes(), { filename: "racket.png", type: "image/png" }),
        });
        expect(response.status).toBe(502);
        expect(callKinds()).toEqual([
            "claim_product_media_cleanup",
            "stage_product_media",
            "storage:POST",
            "claim_product_media_cleanup",
            "storage:DELETE",
            "finish_product_media_cleanup",
        ]);
    });

    test("keeps cleanup retryable if Storage deletion fails", async () => {
        useStaging({ cleanupFails: true });
        const response = await requestCommerce("/admin/product/images/discard", {
            userId: "admin-a",
            userRole: "admin",
            body: { sessionId: session, mediaIds: [5] },
        });
        expect(response.status).toBe(502);
        expect(callKinds()).toEqual(["claim_product_media_cleanup", "storage:DELETE"]);
    });

    test("never deletes a saved original when the database refuses the cleanup claim", async () => {
        setRestResponder(() =>
            jsonResponse({ message: "conflict: only pending product images can be discarded" }, 400),
        );
        const response = await requestCommerce("/admin/product/images/discard", {
            userId: "admin-a",
            userRole: "admin",
            body: { sessionId: session, mediaIds: [5] },
        });
        expect(response.status).toBe(409);
        expect(callKinds()).toEqual(["claim_product_media_cleanup"]);
    });
});
