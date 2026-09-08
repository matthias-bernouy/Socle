import { expect, test } from "bun:test";
import { validateDashboard, type DashboardAction } from "@bernouy/cms-dashboards";
import { validDashboard } from "../validation/validDashboardFixture";
import { productSource } from "../validation/dashboardSourceFixture";

function errors(action: DashboardAction) {
    const dashboard = validDashboard();
    const detail = dashboard.views[1]!;
    if (detail.widget !== "w-detail") {
        throw new Error("Missing detail");
    }
    detail.actions = [action];
    return validateDashboard(dashboard, { source: productSource });
}
const navigation: DashboardAction = {
    id: "parent",
    label: "Parent",
    selection: { opens: "productDetail", row: "$resource.parentId" },
};

test("detail navigation accepts stable resource and selection identities without endpoints", () => {
    for (const row of ["$resource.parentId", "$selection.id", "parent /? é&0"]) {
        expect(errors({ ...navigation, selection: { ...navigation.selection, row } })).toEqual([]);
    }
});

test("navigation rejects missing identities, unsafe expressions and mutation combinations", () => {
    for (const row of [undefined, "", "$result.id", "$field.title", "$resource.__proto__.id"]) {
        expect(
            errors({ ...navigation, selection: { opens: "productDetail", row } }).some((error) =>
                error.includes("selection.row"),
            ),
        ).toBe(true);
    }
    for (const opens of ["missing", "productsTable"]) {
        expect(
            errors({ ...navigation, selection: { opens, row: "$resource.id" } }).some((error) =>
                error.includes("selection.opens"),
            ),
        ).toBe(true);
    }
    expect(
        errors({ ...navigation, endpoint: { endpoint: "getProduct" } }).some((error) =>
            error.includes("cannot combine"),
        ),
    ).toBe(true);
});
