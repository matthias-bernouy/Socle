import { expect, test } from "bun:test";
import { detailKey, DashboardActionScope } from "cms-control/components/admin/Resources/Dashboards/domain";
import { runDashboardMediaAction } from "cms-control/components/admin/Resources/Dashboards/view/actions";
import { setupDashboardActionTests } from "../../../widgets/dashboard-table-actions/setup";
import { dashboard, group } from "./fixtures";

setupDashboardActionTests();

test.each(["success", "failure"])(
    "a late upload %s cannot modify drafts or show a toast after navigation",
    async (outcome) => {
        const scope = new DashboardActionScope();
        const key = detailKey("questionDetail", "question-ref");
        const original = { imageOptions: [{ key: "warm", image: { id: "local:1", url: "blob:local" } }] };
        const drafts = new Map([[key, original]]);
        let complete: () => void = () => {};
        const pending = runDashboardMediaAction(
            {
                group: group(),
                dashboard: dashboard(),
                detail: { collection: "questionDetail", row: "question-ref" },
                drafts,
                actionCoordinator: scope,
                reload: () => {
                    throw new Error("Unexpected detail reload");
                },
                openDetail: () => {},
                submit: () =>
                    new Promise((resolve, reject) => {
                        complete = () =>
                            outcome === "success"
                                ? resolve({ ok: true, mediaId: 101 })
                                : reject(new Error("Late upload failure"));
                    }),
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
                parentItem: original.imageOptions[0],
                value: [{ id: "local:1", url: "blob:local" }],
                files: [new File(["image"], "warm.png")],
            },
        );
        scope.invalidate();
        complete();
        await pending;
        expect(drafts.get(key)).toBe(original);
        expect(document.querySelector("p9r-toast")).toBeNull();
    },
);
