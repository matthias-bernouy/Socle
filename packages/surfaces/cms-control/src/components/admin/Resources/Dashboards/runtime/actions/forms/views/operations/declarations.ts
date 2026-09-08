import type { DashboardAction, DashboardWidget } from "@bernouy/cms-dashboards";

/** Nested list buttons keep their location and use the enclosing detail's read and guard. */
export function detailFormActions(widget: Extract<DashboardWidget, { widget: "w-detail" }>): DashboardAction[] {
    return [
        ...(widget.actions ?? []),
        ...widget.main.flatMap((section) =>
            "widget" in section
                ? (section.actions ?? [])
                      .filter((action) => action.form && action.id !== section.reorderable?.action)
                      .map((action) => ({ ...action, section: section.id }))
                : [],
        ),
    ];
}
