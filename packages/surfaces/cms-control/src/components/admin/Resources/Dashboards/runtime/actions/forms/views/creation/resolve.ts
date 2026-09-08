import type { DashboardDetailOpenRef, DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext, RuntimeDetailWidget } from "../../../../../domain";

export function resolveDetailView(
    ref: DashboardDetailOpenRef,
    context: RenderContext,
): {
    widget: RuntimeDetailWidget;
    context: RenderContext;
} {
    const dashboardId = ref.dashboardId ?? context.dashboard.id;
    const group = (context.groups ?? [context.group]).find((entry) =>
        entry.dashboards.some((dashboard) => dashboard.id === dashboardId),
    );
    const dashboard = group?.dashboards.find((entry) => entry.id === dashboardId);
    const widget = dashboard && findDetail(dashboard.views, ref.viewId);
    if (!group || !dashboard || !widget) {
        throw new Error(`The detail view ${dashboardId}/${ref.viewId} is unavailable.`);
    }
    return {
        widget,
        context: { ...context, group, dashboard, drafts: new Map(), selectedRows: new Map() },
    };
}

function findDetail(widgets: DashboardWidget[], id: string): RuntimeDetailWidget | undefined {
    for (const widget of widgets) {
        if (widget.widget === "w-detail" && widget.id === id) {
            return widget;
        }
        const children =
            widget.widget === "w-section"
                ? widget.children
                : widget.widget === "w-tabs"
                  ? widget.tabs.flatMap((tab) => tab.children)
                  : [];
        const match = findDetail(children, id);
        if (match) {
            return match;
        }
    }
}
