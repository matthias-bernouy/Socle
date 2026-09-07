import { describe, expect, test } from "bun:test";
import {
    capturedFetches,
    expectRpc,
    installCommerceTestEnvironment,
    jsonResponse,
    requestCommerce,
    setRestResponder,
} from "../../harness";

installCommerceTestEnvironment();

describe("taxonomy detail forms", () => {
    for (const kind of ["brand", "category"]) {
        test(`${kind} default read is unpersisted with a nullable identity and revision`, async () => {
            const response = await requestCommerce(`/admin/${kind}`);
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({ id: null, version: null, status: "active", metadata: {} });
            expect(capturedFetches()).toEqual([]);
        });

        test(`${kind} Save accepts body identity with required optimistic version`, async () => {
            setRestResponder((request) =>
                new URL(request.url).pathname.endsWith(`/rpc/upsert_${kind}`)
                    ? jsonResponse({ id: 7, version: 3 })
                    : jsonResponse([]),
            );
            const missing = await requestCommerce(`/admin/${kind}`, { body: { id: 7, name: "Label" } });
            expect(missing.status).toBe(400);
            expect(capturedFetches()).toEqual([]);
            const saved = await requestCommerce(`/admin/${kind}`, { body: { id: 7, expectedVersion: 2 } });
            expect(saved.status).toBe(200);
            expect(expectRpc(`upsert_${kind}`).body).toMatchObject({ [`p_${kind}_id`]: 7, p_expected_version: 2 });
        });

        test(`${kind} Delete accepts a form body and refuses conflicting identities`, async () => {
            setRestResponder(() => jsonResponse({ id: 7, deleted: true }));
            const conflict = await requestCommerce(`/admin/${kind}?id=8`, { method: "DELETE", body: { id: 7 } });
            expect(conflict.status).toBe(400);
            expect(capturedFetches()).toEqual([]);
            const removed = await requestCommerce(`/admin/${kind}`, { method: "DELETE", body: { id: 7 } });
            expect(removed.status).toBe(200);
            expect(expectRpc(`delete_${kind}`).body).toEqual({ [`p_${kind}_id`]: 7 });
        });
    }
});
