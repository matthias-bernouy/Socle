import { expect, test } from "bun:test";
import { validateDashboard, type DashboardDto, type DashboardNavigationListWidget } from "@bernouy/cms-dashboards";

function fixture(): DashboardDto {
    return {
        id: "catalogue",
        source: "catalogue",
        meta: { name: "Catalogue" },
        views: [
            {
                widget: "w-navigation-list",
                id: "brands",
                source: { endpoint: "brands" },
                rowKey: "id",
                item: { title: { path: "name" } },
                reorderable: { action: "reorder", name: "orderedIds" },
                actions: [{ id: "reorder", label: "Reorder", form: { endpoint: "reorderBrands" } }],
            },
        ],
    };
}

test("navigation ordering accepts a typed form and validates its bounded automatic submission", () => {
    expect(validateDashboard(fixture())).toEqual([]);
    for (const patch of [
        { fields: [{ id: "reason", path: "reason", label: "Reason", type: "text" }] },
        { hiddenFields: [{ name: "id", type: "string", value: "a" }] },
        { confirm: "Confirm?" },
        { refresh: "none" },
    ]) {
        const dashboard = fixture();
        const view = dashboard.views[0] as DashboardNavigationListWidget;
        Object.assign(view.actions![0]!.form!, patch);
        expect(validateDashboard(dashboard).join(" ")).toContain("submits only the list order");
    }
    for (const name of ["__proto__", "ids.constructor", "ids[prototype]"]) {
        const dashboard = fixture();
        (dashboard.views[0] as DashboardNavigationListWidget).reorderable!.name = name;
        expect(validateDashboard(dashboard).join(" ")).toContain("safe control name");
    }
});
