import { describe, expect, test } from "bun:test";
import type { DashboardDto } from "@bernouy/cms-dashboards";
import "cms-control/components";
import { widgetsForSelection } from "cms-control/components/admin/Resources/Dashboards/domain";
import { mountDashboardWidgets } from "cms-control/components/admin/Resources/Dashboards/runtime/mounting/mount";
import type { DashboardSourceGroup } from "cms-control/components/admin/Resources/Dashboards/types";

describe("dashboard detail main widgets", () => {
    test("mounts a navigation list in the detail main slot with its owning selection", () => {
        const dashboard = detailDashboard();
        const group = sourceGroup(dashboard);
        const detail = { collection: "sectionDetail", row: "section-1" };
        const root = document.createElement("div");

        mountDashboardWidgets(
            root,
            widgetsForSelection(dashboard, detail),
            {
                group,
                dashboard,
                selectedRows: new Map(),
                drafts: new Map(),
            },
            "root",
            new Map(),
            detail,
        );
        const detailElement = root.querySelector<HTMLElement>("cms-dashboard-w-detail")!;
        const wrapper = detailElement.querySelector<HTMLElement>('cms-dashboard-w-navigation-list[slot="bound-main"]')!;
        const navigation = wrapper;
        const source = new URL(
            wrapper.querySelector("[cms-source]")!.getAttribute("cms-source")!.split(" as ")[0]!,
            window.location.origin,
        );
        const mainChildren = Array.from(detailElement.querySelectorAll(':scope > [slot="bound-main"]')).map(
            (item) => item.tagName,
        );
        expect(detailElement.hasAttribute("data-declarative")).toBeTrue();
        expect(wrapper.parentElement).toBe(detailElement);
        expect(mainChildren).toEqual(["CMS-DETAIL-SECTION", "CMS-DASHBOARD-W-NAVIGATION-LIST", "CMS-DETAIL-SECTION"]);
        expect(navigation).not.toBeNull();
        expect(source.searchParams.get("context")).toBe("section-1");
        root.remove();
    });

    test("uses nested navigation targets when choosing the dashboard's main widgets", () => {
        const dashboard = detailDashboard();

        expect(widgetsForSelection(dashboard, null).map((widget) => widget.id)).toEqual(["sectionDetail"]);
        expect(
            widgetsForSelection(dashboard, { collection: "sectionDetail", row: "section-1" }).map(
                (widget) => widget.id,
            ),
        ).toEqual(["sectionDetail"]);
        expect(
            widgetsForSelection(dashboard, { collection: "questionDetail", row: "question-1" }).map(
                (widget) => widget.id,
            ),
        ).toEqual(["questionDetail"]);
    });
});

function detailDashboard(): DashboardDto {
    return {
        id: "forms",
        source: "forms",
        views: [
            {
                widget: "w-detail",
                id: "sectionDetail",
                source: { endpoint: "manageSection", params: { ref: "$selection.id" } },
                main: [
                    { id: "content", title: "Content", fields: [] },
                    {
                        widget: "w-navigation-list",
                        id: "questionNavigation",
                        source: {
                            endpoint: "manageQuestions",
                            params: { context: "$selection.sectionDetail.id" },
                            itemsPath: "items",
                        },
                        rowKey: "id",
                        item: { title: { path: "title" } },
                        selection: { opens: "questionDetail" },
                    },
                    { id: "footer", title: "Footer", fields: [] },
                ],
            },
            {
                widget: "w-detail",
                id: "questionDetail",
                source: { endpoint: "manageQuestion", params: { ref: "$selection.id" } },
                main: [],
            },
        ],
    };
}

function sourceGroup(dashboard: DashboardDto): DashboardSourceGroup {
    return {
        source: {
            urn: "urn:forms",
            id: "forms",
            name: "Forms",
            endpointCount: 3,
            dashboardCount: 1,
            readonly: false,
        },
        endpoints: [
            {
                endpointId: "manageSection",
                method: "GET",
                targetUrl: "https://example.test/section",
                params: [{ name: "ref", in: "query", type: "string", required: true }],
            },
            {
                endpointId: "manageQuestions",
                method: "GET",
                targetUrl: "https://example.test/questions",
                params: [{ name: "context", in: "query", type: "string", required: true }],
            },
            {
                endpointId: "manageQuestion",
                method: "GET",
                targetUrl: "https://example.test/question",
                params: [{ name: "ref", in: "query", type: "string", required: true }],
            },
        ],
        dashboards: [dashboard],
    };
}
