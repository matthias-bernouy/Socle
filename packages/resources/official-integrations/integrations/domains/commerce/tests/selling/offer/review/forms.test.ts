import { expect, test } from "bun:test";
import { capturedFetches, expectSingleRpc, installCommerceTestEnvironment, requestCommerce } from "../../../harness";

installCommerceTestEnvironment();

for (const [kind, intent, argument] of [
    ["offer", "request_price", "action"],
    ["offer", "approve", "action"],
    ["offer", "reject", "action"],
    ["seller", "verified", "status"],
    ["seller", "suspended", "status"],
]) {
    test(`${kind} ${intent} receives its independent form identity, revision and fields`, async () => {
        const amounts = intent === "request_price" ? { minimumAmount: 1250, maximumAmount: 1875 } : {};
        const response = await requestCommerce(`/admin/${kind}/review`, {
            userId: "trusted-admin",
            body: {
                id: 42,
                expectedVersion: 7,
                [argument!]: intent,
                reason: "Review note",
                ...amounts,
                adminId: "spoofed",
            },
        });
        expect(response.status).toBe(200);
        expect(expectSingleRpc(`review_${kind}`).body).toEqual({
            [`p_${kind}_id`]: 42,
            p_expected_version: 7,
            [`p_${argument}`]: intent,
            p_reason: "Review note",
            p_admin_id: "trusted-admin",
            ...(intent === "request_price" ? { p_minimum_amount: 1250, p_maximum_amount: 1875 } : {}),
        });
    });
}

for (const kind of ["offer", "seller"]) {
    test(`${kind} review refuses missing identity or revision before accessing data`, async () => {
        for (const body of [{ expectedVersion: 7 }, { id: 42 }, { id: "invalid", expectedVersion: 7 }]) {
            const response = await requestCommerce(`/admin/${kind}/review`, {
                body: { action: "approve", status: "verified", ...body },
            });
            expect(response.status).toBe(400);
        }
        expect(capturedFetches()).toEqual([]);
    });
}
