import { describe, expect, test } from "bun:test";
import { configureDetail, mountDetail, setSourceData } from "../../detail/boundDetail";
import type { DashboardWDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import type { DetailWidget } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/runtime/fieldState";
import { detailKey } from "cms-control/components/admin/Resources/Dashboards/domain";
import { executeDashboardMediaAction } from "cms-control/components/admin/Resources/Dashboards/runtime/actions";
import { runDashboardMediaAction } from "cms-control/components/admin/Resources/Dashboards/view/actions";
import { setupDashboardActionTests } from "../../../widgets/dashboard-table-actions/setup";
import { dashboard, group, uploadSubmission } from "./fixtures";

setupDashboardActionTests();

describe("dashboard nested media actions", () => {
    test("uploads a list card image and maps the endpoint result to its file endpoint", async () => {
        const requests: Request[] = [];
        globalThis.fetch = (async (input, init) => {
            const request = new Request(input, init);
            requests.push(request);
            return request.method === "GET"
                ? Response.json({ ref: "question-ref", options: [] })
                : Response.json({ ok: true, mediaId: 101 });
        }) as typeof fetch;

        const result = await executeDashboardMediaAction(
            group(),
            dashboard(),
            { collection: "questionDetail", row: "question-ref" },
            {
                action: "upload",
                resource: { ref: "question-ref", options: [] },
                field: "imageOptions",
                rowKey: "question-ref",
                itemField: "image",
                itemIndex: 0,
                itemKey: "warm",
                itemPath: "image",
                parentItem: { key: "warm", label: "Warm" },
                value: [],
                files: [new File(["image"], "warm.png", { type: "image/png" })],
            },
            { imageOptions: [{ key: "warm", label: "Warm" }] },
            [group()],
            uploadSubmission,
        );

        expect(result).toMatchObject({ handled: true, nested: true, item: { id: "101" } });
        expect(result.item?.url).toContain("/.cms/sources/forms/choiceImage?id=101");
        expect(requests.map((request) => request.method)).toEqual(["POST"]);
        expect(requests[0]?.url).toContain("uploadChoiceImage?ref=question-ref");
        expect((await requests[0]!.formData()).get("file")).toBeInstanceOf(File);
    });

    test("patches a nested media card without discarding other unsaved fields", async () => {
        globalThis.fetch = (async (input, init) => {
            const request = new Request(input, init);
            return request.method === "GET"
                ? Response.json({ ref: "question-ref", options: [] })
                : Response.json({ ok: true, mediaId: 101 });
        }) as typeof fetch;
        const widget = document.createElement("cms-dashboard-w-detail") as DashboardWDetail;
        configureDetail(widget, dashboard().views[0] as DetailWidget);
        const items = [
            { key: "cool", label: "Cool", image: { id: "202", url: "/cool" } },
            { key: "warm", label: "Warm", image: { id: "local:1", url: "blob:local" } },
        ];
        setSourceData(widget, { ref: "question-ref", options: items });
        await mountDetail(widget);
        widget.applyFieldDraft("imageOptions", items);
        const key = detailKey("questionDetail", "question-ref");
        const drafts = new Map([
            [
                key,
                {
                    type: "choice",
                    presentation: "image-grid",
                    imageOptions: structuredClone(items),
                },
            ],
        ]);

        await runDashboardMediaAction(
            {
                submit: uploadSubmission,
                group: group(),
                dashboard: dashboard(),
                detail: { collection: "questionDetail", row: "question-ref" },
                drafts,
                reload: () => {},
                openDetail: () => {},
            },
            {
                action: "upload",
                resource: { ref: "question-ref", options: [] },
                field: "imageOptions",
                rowKey: "question-ref",
                itemField: "image",
                itemIndex: 0,
                itemKey: "warm",
                itemPath: "image",
                parentItem: structuredClone(items[0]),
                value: [{ id: "local:1", url: "blob:local" }],
                files: [new File(["image"], "warm.png", { type: "image/png" })],
            },
            widget,
        );

        expect(drafts.get(key)).toMatchObject({
            type: "choice",
            presentation: "image-grid",
            imageOptions: [{ image: { id: "202" } }, { image: { id: "101" } }],
        });
        expect(widget.currentFieldValues().imageOptions).toMatchObject([
            { image: { id: "202" } },
            { image: { id: "101" } },
        ]);
    });
});
