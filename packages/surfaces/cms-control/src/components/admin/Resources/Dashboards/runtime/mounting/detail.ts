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
        (element as DashboardWDetail).setBindingValue({});
        return element;
    }
    const directResource = matchingDetailResource(widget, context, rowKey);
    if (directResource) {
        return detailContent(widget, context, rowKey, directResource);
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
        directResource === null
            ? widget
            : {
                  ...widget,
                  source: { ...widget.source, itemPath: undefined },
              };
    element.dataset.widgetId = widget.id;
    element.configure(config);
    if (directResource !== null) {
        element.setBindingValue(directResource.resource);
    }
    element.setAttribute("data-row-key", rowKey);
    element.setAttribute("data-source-id", context.dashboard.source);
    const selection = { collection: widget.id, row: rowKey };
    for (const [index, mainItem] of widget.main.entries()) {
        if ("widget" in mainItem) {
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
