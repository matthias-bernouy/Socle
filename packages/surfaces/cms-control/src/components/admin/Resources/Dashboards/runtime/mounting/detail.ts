import { setSourceData } from "@bernouy/components";
import { setValueAt } from "../expressions";
import { composeDetail, supportsBoundDetail } from "../../widgets/w-detail/binding/composition";
import type { DetailSelection, RenderContext, RuntimeDetailWidget } from "../../domain";
import { DashboardWDetail } from "../../widgets/w-detail/WDetail";
import "./input";
import { detailReloadEvent } from "../reload";
import { relationDetailSectionElement } from "./mountRelations";
import { requiredSourceParams, sourceWrapper } from "./mountSource";
import { navigationListElement } from "./navigation";

export function detailElement(
    widget: RuntimeDetailWidget,
    context: RenderContext,
    detail: DetailSelection | null,
): HTMLElement {
    const rowKey = detail?.row ?? "";
    if (rowKey === "__new__") {
        const element = detailContent(widget, context, rowKey);
        publishDetailResource(element as DashboardWDetail, widget, {});
        if (element.hasAttribute("data-declarative")) {
            attachDetailSource(element, widget, context, rowKey);
        }
        return element;
    }
    const directResource = matchingDetailResource(widget, context, rowKey);
    if (directResource) {
        const element = detailContent(widget, context, rowKey, directResource);
        if (element.hasAttribute("data-declarative")) {
            attachDetailSource(element, widget, context, rowKey);
        }
        return element;
    }
    const element = detailContent(widget, context, rowKey);
    attachDetailSource(element, widget, context, rowKey);
    return element;
}

export function attachDetailSource(
    element: HTMLElement,
    widget: RuntimeDetailWidget,
    context: RenderContext,
    rowKey: string,
): void {
    const wrapper = sourceWrapper(
        context.dashboard.source,
        widget.source,
        { selection: { id: rowKey } },
        "dashboardData",
        requiredSourceParams(context, widget.source),
    );
    wrapper.setAttribute(
        "cms-reload-on",
        detailReloadEvent(context.dashboard.source, context.dashboard.id, widget.id, rowKey),
    );
    if (element.hasAttribute("data-declarative")) {
        for (const child of Array.from(wrapper.children)) {
            child.setAttribute("slot", "source-status");
        }
        element.append(...Array.from(wrapper.childNodes));
        element.setAttribute("cms-source", wrapper.getAttribute("cms-source") ?? "");
        element.setAttribute("cms-reload-on", wrapper.getAttribute("cms-reload-on")!);
        return;
    }
    const input = document.createElement("cms-dashboard-input");
    input.setAttribute("kind", "detail");
    input.setAttribute("cms-bind-value", "dashboardData");
    input.setAttribute("cms-condition", "$source.loaded || $source.empty");
    input.hidden = true;
    wrapper.setAttribute("slot", "source-status");
    const status = document.createElement("cms-dashboard-input");
    status.setAttribute("kind", "detail-status");
    status.setAttribute("cms-bind-value", "$source");
    status.hidden = true;
    wrapper.append(status, input);
    element.append(wrapper);
}

function detailContent(
    widget: RuntimeDetailWidget,
    context: RenderContext,
    rowKey: string,
    directResource: NonNullable<RenderContext["detailResource"]> | null = null,
): HTMLElement {
    const element = new DashboardWDetail();
    const config =
        directResource === null || supportsBoundDetail(widget)
            ? widget
            : {
                  ...widget,
                  source: { ...widget.source, itemPath: undefined },
              };
    element.dataset.widgetId = widget.id;
    element.configure(config);
    const selection = { collection: widget.id, row: rowKey };
    if (element.hasAttribute("data-declarative")) {
        element.append(composeDetail(widget, (child) => navigationListElement(child, context, selection)));
    }
    if (directResource !== null) {
        publishDetailResource(element, widget, directResource.resource);
    }
    element.setAttribute("data-row-key", rowKey);
    element.setAttribute("data-source-id", context.dashboard.source);
    for (const [index, mainItem] of widget.main.entries()) {
        if ("widget" in mainItem && !element.hasAttribute("data-declarative")) {
            element.append(navigationListElement(mainItem, context, selection, `main-widget-${index}`));
        }
    }
    for (const relationWidget of widget.relationWidgets ?? []) {
        element.append(relationDetailSectionElement(relationWidget));
    }
    return element;
}

function matchingDetailResource(widget: RuntimeDetailWidget, context: RenderContext, row: string) {
    const resource = context.detailResource;
    return resource &&
        resource.resource !== null &&
        resource.resource !== undefined &&
        resource.sourceId === context.dashboard.source &&
        resource.dashboardId === context.dashboard.id &&
        resource.collection === widget.id &&
        resource.row === row
        ? resource
        : null;
}

export function publishDetailResource(element: DashboardWDetail, widget: RuntimeDetailWidget, resource: unknown): void {
    if (!element.hasAttribute("data-declarative")) {
        element.setBindingValue(resource);
        return;
    }
    if (widget.source.itemPath) {
        const data: Record<string, unknown> = {};
        setValueAt(data, widget.source.itemPath, resource);
        setSourceData(element, data);
    } else {
        setSourceData(element, resource);
    }
}
