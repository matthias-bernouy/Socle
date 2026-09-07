import { retainWidgets } from "./reconcile";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { DashboardRuntimeWidget, DetailSelection, RenderContext } from "../../domain";
import "./../../widgets/w-section/WSection";
import { tableWithSource } from "./table";
import { detailElement } from "./detail";
import { navigationListElement, selectionVars } from "./navigation";
import { requiredSourceParams, sourceWrapper } from "./mountSource";

let tabsSequence = 0;

export function mountDashboardWidgets(
    root: HTMLElement,
    widgets: DashboardRuntimeWidget[],
    context: RenderContext,
    key: string,
    tabState: Map<string, number>,
    detail: DetailSelection | null,
): void {
    if (retainWidgets(root, widgets, context, detail)) {
        return;
    }
    const core = document.createElement("p9r-stack");
    core.setAttribute("gap", "md");
    core.setAttribute("trim", "");
    core.className = "dashboard-widget-binding";
    core.replaceChildren(
        ...widgets.map((widget, index) => widgetElement(widget, context, `${key}.${index}`, tabState, detail)),
    );
    root.replaceChildren(core);
}

function widgetElement(
    widget: DashboardRuntimeWidget,
    context: RenderContext,
    key: string,
    tabState: Map<string, number>,
    detail: DetailSelection | null,
): HTMLElement {
    if (widget.widget === "w-section") {
        return sectionElement(widget, context, key, tabState, detail);
    }
    if (widget.widget === "w-tabs") {
        return tabsElement(widget, context, key, tabState, detail);
    }
    if (widget.widget === "w-table") {
        return tableElement(widget, context, detail);
    }
    if (widget.widget === "w-navigation-list") {
        return navigationListElement(widget, context, detail);
    }
    if (widget.widget === "w-detail") {
        return detailElement(widget, context, detail);
    }
    return document.createElement("span");
}

function sectionElement(
    widget: Extract<DashboardWidget, { widget: "w-section" }>,
    context: RenderContext,
    key: string,
    tabState: Map<string, number>,
    detail: DetailSelection | null,
): HTMLElement {
    const element = document.createElement("cms-dashboard-w-section");
    element.setAttribute("heading", widget.title);
    if (widget.description) {
        element.setAttribute("description", widget.description);
    }
    const stack = document.createElement("p9r-stack");
    stack.setAttribute("gap", "md");
    stack.setAttribute("trim", "");
    stack.className = "widget-stack";
    stack.append(
        ...widget.children.map((child, index) => widgetElement(child, context, `${key}.${index}`, tabState, detail)),
    );
    element.append(stack);
    return element;
}

function tabsElement(
    widget: Extract<DashboardWidget, { widget: "w-tabs" }>,
    context: RenderContext,
    key: string,
    tabState: Map<string, number>,
    detail: DetailSelection | null,
): HTMLElement {
    const panel = document.createElement("p9r-card");
    const tabs = document.createElement("p9r-tabs");
    tabs.setAttribute("wrap", "");
    const prefix = `dashboard-tabs-${++tabsSequence}`;
    const activeIndex = Math.min(tabState.get(key) ?? 0, Math.max(widget.tabs.length - 1, 0));
    const populate = (index: number): void => {
        const body = tabs.children[index];
        const tab = widget.tabs[index];
        if (!body || !tab || body.childElementCount) {
            return;
        }
        const stack = document.createElement("p9r-stack");
        stack.setAttribute("gap", "md");
        stack.setAttribute("trim", "");
        stack.append(
            ...tab.children.map((child, childIndex) =>
                widgetElement(child, context, `${key}.${index}.${childIndex}`, tabState, detail),
            ),
        );
        body.append(stack);
    };
    for (const [index, tab] of widget.tabs.entries()) {
        const body = document.createElement("p9r-tab-panel");
        body.id = `${prefix}-${index}`;
        body.setAttribute("label", tab.label);
        tabs.append(body);
    }
    tabs.setAttribute("active", `${prefix}-${activeIndex}`);
    populate(activeIndex);
    tabs.addEventListener("change", (event) => {
        if (event.target !== tabs) {
            return;
        }
        const id = (event as CustomEvent).detail.active;
        const index = Array.from(tabs.children).findIndex((body) => body.id === id);
        if (index >= 0) {
            tabState.set(key, index);
            populate(index);
        }
    });
    panel.append(tabs);
    return panel;
}

function tableElement(
    widget: Extract<DashboardWidget, { widget: "w-table" }>,
    context: RenderContext,
    detail: DetailSelection | null,
): HTMLElement {
    const filters = { ...(context.filters?.get(widget.id) ?? {}) };
    const wrapper = sourceWrapper(
        context.dashboard.source,
        widget.source,
        { ...selectionVars(detail), filters },
        "dashboardData",
        requiredSourceParams(context, widget.source),
    );
    const element = tableWithSource(widget, wrapper, filters);
    element.setAttribute("data-selected", context.selectedRows.get(widget.selection?.opens ?? widget.id) ?? "");
    return element;
}
