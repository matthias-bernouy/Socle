import { expect, test } from "bun:test";
import { validateDashboard, type DashboardWidget } from "@bernouy/cms-dashboards";
import { validDashboard } from "../validation/validDashboardFixture";

test("management action forms preserve their envelope and reject missing ids, collisions and read usage", () => {
    const dashboard = validDashboard();
    const detail = dashboard.views[1] as Extract<DashboardWidget, { widget: "w-detail" }>;
    const management = { installationId: "provider", operation: "action" as const, actionId: "publish" };
    detail.save = {
        management,
        valuesPath: "input",
        hiddenFields: [{ name: "input[expectedVersion]", type: "string", value: "$resource.version" }],
    };
    expect(validateDashboard(dashboard)).toEqual([]);
    detail.save.hiddenFields!.push({ name: "actionId", type: "string", value: "override" });
    expect(validateDashboard(dashboard).join(" ")).toContain("conflicts with another form control");
    detail.save.hiddenFields!.pop();
    detail.source = { management };
    expect(validateDashboard(dashboard).join(" ")).toContain("cannot be used as a data source");
    management.actionId = "";
    expect(validateDashboard(dashboard).join(" ")).toContain("actionId");
});
