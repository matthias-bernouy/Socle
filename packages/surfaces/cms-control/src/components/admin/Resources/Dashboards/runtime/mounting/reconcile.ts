import type { DashboardRuntimeWidget, DetailSelection, RenderContext } from "../../domain";
import { updateTableFilters } from "../../widgets/w-table/composition";
import type { DashboardWTable } from "../../widgets/w-table/WTable";
import type { DashboardWDetail } from "../../widgets/w-detail/WDetail";
import { requiredSourceParams, sourceWrapper } from "./mountSource";
import { attachDetailSource, publishDetailResource } from "./detail";
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
    const previousResource = contexts.get(root)?.detailResource;
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
            } else if (widget.widget === "w-detail") {
                const target = Array.from(root.querySelectorAll<DashboardWDetail>("cms-dashboard-w-detail")).find(
                    (node) => node.dataset.widgetId === widget.id,
                );
                const resource = context.detailResource;
                if (
                    !resource ||
                    resource.collection !== widget.id ||
                    resource.row !== (detail?.row ?? "") ||
                    resource.sourceId !== context.dashboard.source ||
                    resource.dashboardId !== context.dashboard.id ||
                    resource.resource == null
                ) {
                    if (
                        target?.hasAttribute("data-declarative") &&
                        previousResource?.collection === widget.id &&
                        previousResource.resource != null
                    ) {
                        target.ownerDocument.dispatchEvent(new Event(target.getAttribute("cms-reload-on")!));
                    }
                    if (
                        target &&
                        !target.hasAttribute("data-declarative") &&
                        detail?.row !== "__new__" &&
                        !target.querySelector('[slot="source-status"]')
                    ) {
                        target.configure(widget);
                        attachDetailSource(target, widget, context, detail?.row ?? "");
                    }
                    continue;
                }
                if (target?.hasAttribute("data-declarative")) {
                    publishDetailResource(target, widget, resource.resource);
                    continue;
                }
                if (target) {
                    target.querySelector('[slot="source-status"]')?.remove();
                    target.configure({ ...widget, source: { ...widget.source, itemPath: undefined } });
                    target.setBindingValue(resource.resource);
                }
            }
        }
    };
    visit(widgets);
    return true;
}
