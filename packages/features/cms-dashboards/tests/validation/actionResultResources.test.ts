import { expect, test } from "bun:test";
import { validateDashboard, type DashboardWidget } from "@bernouy/cms-dashboards";
import { validDashboard } from "./validDashboardFixture";

test("native actions reject resource replacement and mapped JSON mutation endpoints", () => {
    const dashboard = validDashboard();
    const detail = dashboard.views[1] as Extract<DashboardWidget, { widget: "w-detail" }>;
    Object.assign(detail.actions![0]!, { after: { resource: "$result" } });
    expect(validateDashboard(dashboard).join(" ")).toContain("resource is obsolete");
    detail.actions = [
        { id: "legacy", label: "Legacy", endpoint: { endpoint: "updateProduct", body: { title: "$field.title" } } },
    ];
    expect(validateDashboard(dashboard).join(" ")).toContain("only supported for downloads");
});
