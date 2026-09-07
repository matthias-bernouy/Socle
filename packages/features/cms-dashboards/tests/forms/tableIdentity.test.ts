import { expect, test } from "bun:test";
import { validateDashboard, type DashboardField } from "@bernouy/cms-dashboards";
import { detail } from "../validation/typedDetailFixtures";

const field: Extract<DashboardField, { type: "table" }> = {
    id: "axes",
    path: "axes",
    label: "Axes",
    type: "table",
    editable: true,
    rowKey: "key",
    columns: [{ id: "value", path: "value", label: "Value", editable: true }],
};

test("validates row identity paths independently from editable values", () => {
    expect(validateDashboard(detail([field]))).toEqual([]);
    expect(
        validateDashboard(detail([{ ...field, rowKey: "__proto__.key" }])).some((error) =>
            error.includes("safe dotted data path"),
        ),
    ).toBe(true);
    expect(
        validateDashboard(detail([{ ...field, rowKey: "value" }])).some((error) => error.includes("must not overlap")),
    ).toBe(true);
    expect(
        validateDashboard(detail([{ ...field, rowKey: "value.child" }])).some((error) =>
            error.includes("must not overlap"),
        ),
    ).toBe(true);
    expect(
        validateDashboard(detail([{ ...field, editable: false }])).some((error) =>
            error.includes("rowKey requires an editable table"),
        ),
    ).toBe(true);
});
