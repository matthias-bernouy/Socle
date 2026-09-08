import { describe, expect, test } from "bun:test";
import { executeDashboardTableAction } from "cms-control/components/admin/Resources/Dashboards/runtime/actions";
import { dashboard, group } from "../fixtures/newsletter";
import { setupDashboardActionTests } from "../setup";

setupDashboardActionTests();

describe("dashboard table actions", () => {
    test("downloads file responses from table endpoint actions", async () => {
        const requests: Request[] = [];
        globalThis.fetch = (async (input, init) => {
            const request = new Request(input, init);
            requests.push(request);
            return new Response("email,subscribed\nuser@example.com,true\n", {
                status: 200,
                headers: { "content-type": "text/csv; charset=utf-8" },
            });
        }) as typeof fetch;

        const result = await executeDashboardTableAction(
            group(),
            dashboard(),
            "exportSubscriptions",
            "subscriptionsTable",
        );

        expect(requests).toHaveLength(1);
        expect(requests[0]!.url).toBe("http://localhost:4999/.cms/sources/newsletter/exportSubscriptions");
        expect(requests[0]!.headers.get("accept")).toBe("*/*");
        expect(result.kind).toBe("download");
        if (result.kind === "download") {
            expect(result.filename).toBe("newsletter-subscriptions.csv");
            expect(await result.blob.text()).toBe("email,subscribed\nuser@example.com,true\n");
        }
    });

    test("passes the active table filters to endpoint actions", async () => {
        const requests: Request[] = [];
        globalThis.fetch = (async (input, init) => {
            requests.push(new Request(input, init));
            return new Response("email,subscribed\n", {
                status: 200,
                headers: { "content-type": "text/csv; charset=utf-8" },
            });
        }) as typeof fetch;
        const sourceGroup = group();

        await executeDashboardTableAction(
            sourceGroup,
            dashboard(),
            "exportSubscriptions",
            "subscriptionsTable",
            undefined,
            [sourceGroup],
            { q: "ada", subscribed: "true" },
        );

        expect(requests).toHaveLength(1);
        expect(new URL(requests[0]!.url).searchParams.toString()).toBe("q=ada&subscribed=true");
    });
});
