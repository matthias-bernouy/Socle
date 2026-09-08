import { describe, expect, test } from "bun:test";
import {
    capturedFetches,
    installCommerceTestEnvironment,
    jsonResponse,
    requestCommerce,
    setRestResponder,
} from "../../../harness";
import { imageForm, pngBytes } from "../fixtures";

installCommerceTestEnvironment();
const token = "11111111-1111-4111-8111-111111111111";

describe("offer shared form transport", () => {
    test("reads fresh settings-based defaults without creating a resource", async () => {
        setRestResponder(() => jsonResponse([{ default_currency: "usd", whole_unit_prices: false }]));
        const first = await requestCommerce("/admin/offer");
        const second = await requestCommerce("/admin/offer");
        const a = await first.json();
        expect(a).toMatchObject({ id: null, version: null, media: [], currency: "usd", wholeUnitPrices: false });
        expect((await second.json()).creationToken).not.toBe(a.creationToken);
        expect(first.headers.get("cache-control")).toBe("private, no-store");
        expect(capturedFetches().every((call) => call.method === "GET")).toBe(true);
    });

    test("submits the form identity, version and ordered media with trusted ownership", async () => {
        setRestResponder(() => jsonResponse({ id: 42, version: 8 }));
        const response = await requestCommerce("/admin/offer", {
            userId: "admin-a",
            userRole: "admin",
            body: {
                id: 42,
                expectedVersion: 7,
                mediaIds: [12, 11],
                uploadSessionId: token,
                internalCmsUserId: "forged",
            },
        });
        expect(response.status).toBe(200);
        expect(capturedFetches()[0]!.body).toMatchObject({
            p_offer_id: 42,
            p_expected_version: 7,
            p_payload: { mediaIds: [12, 11], uploadSessionId: token, internalCmsUserId: "admin-a" },
        });
    });

    test("creates with a stable retry slug and refuses inconsistent identifiers or missing revisions", async () => {
        setRestResponder(() => jsonResponse({ id: 42, version: 1 }));
        for (let i = 0; i < 2; i++) {
            const response = await requestCommerce("/admin/offer", {
                userId: "admin-a",
                userRole: "admin",
                body: { title: "New offer", creationToken: token, mediaIds: [] },
            });
            expect(response.status).toBe(200);
        }
        expect(capturedFetches()[0]!.body.p_payload).toEqual(capturedFetches()[1]!.body.p_payload);
        expect(capturedFetches()[0]!.body.p_payload.slug).toBe(`new-offer-${token}`);
        expect((await requestCommerce("/admin/offer?id=2", { body: { id: 3, expectedVersion: 1 } })).status).toBe(400);
        expect((await requestCommerce("/admin/offer", { body: { id: 3 } })).status).toBe(400);
        expect(capturedFetches()).toHaveLength(2);
    });

    test("keeps generated slugs within the database format for long titles", async () => {
        setRestResponder(() => jsonResponse({ id: 42, version: 1 }));
        const response = await requestCommerce("/admin/offer", { body: { title: "Very long offer ".repeat(30) } });
        expect(response.status).toBe(200);
        const slug = capturedFetches()[0]!.body.p_payload.slug;
        expect(slug.length).toBeLessThanOrEqual(160);
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });

    test("requires an authenticated administrator for staging, discarding, and session attachment", async () => {
        for (const userRole of [null, "member"]) {
            expect(
                (
                    await requestCommerce("/admin/offer/image/stage", {
                        userId: "a",
                        userRole,
                        formData: imageForm(pngBytes()),
                    })
                ).status,
            ).toBe(403);
            expect(
                (
                    await requestCommerce("/admin/offer/images/discard", {
                        userId: "a",
                        userRole,
                        body: { sessionId: token, mediaIds: [1] },
                    })
                ).status,
            ).toBe(403);
            expect(
                (
                    await requestCommerce("/admin/offer", {
                        userId: "a",
                        userRole,
                        body: { title: "Forbidden", uploadSessionId: token },
                    })
                ).status,
            ).toBe(403);
        }
        expect(capturedFetches()).toEqual([]);
    });
});
