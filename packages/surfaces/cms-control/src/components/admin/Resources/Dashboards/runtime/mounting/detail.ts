import { setSourceData } from "@bernouy/components";
import { setValueAt } from "../expressions";
import { composeDetail } from "../../widgets/w-detail/binding/composition";
import type { DetailSelection, RenderContext, RuntimeDetailWidget } from "../../domain";
import { DashboardWDetail } from "../../widgets/w-detail/WDetail";
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
        attachDetailSource(element, widget, context, rowKey);
        return element;
    }
    const directResource = matchingDetailResource(widget, context, rowKey);
    if (directResource) {
        const element = detailContent(widget, context, rowKey, directResource);
        attachDetailSource(element, widget, context, rowKey);
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
    for (const child of Array.from(wrapper.children)) {
        child.setAttribute("slot", "source-status");
    }
    element.append(...Array.from(wrapper.childNodes));
    element.setAttribute("cms-source", wrapper.getAttribute("cms-source") ?? "");
    element.setAttribute("cms-reload-on", wrapper.getAttribute("cms-reload-on")!);
}

function detailContent(
    widget: RuntimeDetailWidget,
    context: RenderContext,
    rowKey: string,
    directResource: NonNullable<RenderContext["detailResource"]> | null = null,
): HTMLElement {
    const element = new DashboardWDetail();
    element.dataset.widgetId = widget.id;
    element.configure(widget);
    const selection = { collection: widget.id, row: rowKey };
    element.append(composeDetail(widget, (child) => navigationListElement(child, context, selection)));
    if (directResource !== null) {
        publishDetailResource(element, widget, directResource.resource);
    }
    element.setAttribute("data-row-key", rowKey);
    element.setAttribute("data-source-id", context.dashboard.source);
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
    if (widget.source.itemPath) {
        const data: Record<string, unknown> = {};
        setValueAt(data, widget.source.itemPath, resource);
        setSourceData(element, data);
    } else {
        setSourceData(element, resource);
    }
}
