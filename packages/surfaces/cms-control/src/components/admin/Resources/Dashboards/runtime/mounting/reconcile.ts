import type { DashboardRuntimeWidget, DetailSelection, RenderContext } from "../../domain";
import { updateTableFilters } from "../../widgets/w-table/composition";
import type { DashboardWTable } from "../../widgets/w-table/WTable";
import { requiredSourceParams, sourceWrapper } from "./mountSource";
import { selectionVars } from "./navigation";

const contexts = new WeakMap<HTMLElement, RenderContext>();
const snapshots = new WeakMap<HTMLElement, string>();

export function retainWidgets(
    root: HTMLElement,
    widgets: DashboardRuntimeWidget[],
    context: RenderContext,
    detail: DetailSelection | null,
): boolean {
    const signature = JSON.stringify([widgets, context.dashboard.source, context.dashboard.id, detail]);
    if (snapshots.get(root) !== signature || !root.childElementCount) {
        snapshots.set(root, signature);
        contexts.set(root, context);
        return false;
    }
    Object.assign(contexts.get(root)!, context);
    const visit = (items: DashboardRuntimeWidget[]): void => {
        for (const widget of items) {
            if (widget.widget === "w-section") {
                visit(widget.children);
            } else if (widget.widget === "w-tabs") {
                widget.tabs.forEach((tab) => visit(tab.children));
            } else if (widget.widget === "w-table") {
                const table = Array.from(root.querySelectorAll<DashboardWTable>("cms-dashboard-w-table")).find(
                    (node) => node.dataset.widgetId === widget.id,
                );
                if (!table) {
                    continue;
                }
                const filters = { ...(context.filters?.get(widget.id) ?? {}) };
                updateTableFilters(table, filters);
                const source = table;
                const next = sourceWrapper(
                    context.dashboard.source,
                    widget.source,
                    { ...selectionVars(detail), filters },
                    "dashboardData",
                    requiredSourceParams(context, widget.source),
                );
                const url = next.getAttribute("cms-source");
                if (source && url && source.getAttribute("cms-source") !== url) {
                    source.setAttribute("cms-source", url);
                }
            }
        }
    };
    visit(widgets);
    return true;
}
