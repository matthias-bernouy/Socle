import type { DashboardNavigationListWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../domain";
import { configureForm, formId, submissionName } from "../../../runtime/actions/forms/views/composition";
import type { DashboardWNavigationList } from "../WNavigationList";
import markup from "cms-control/static/admin/_content/sources/_runtime/forms/order.html" with { type: "text" };

export function composeNavigationOrder(
    list: DashboardWNavigationList,
    source: HTMLElement,
    widget: DashboardNavigationListWidget,
    context: RenderContext,
    owner?: HTMLElement,
): boolean {
    const operation = widget.actions?.find((action) => action.id === widget.reorderable?.action)?.form;
    if (!operation) {
        return false;
    }
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    const form = template.content.firstElementChild as HTMLFormElement;
    configureForm(form, operation, context);
    source.id = formId();
    form.setAttribute("cms-source-success-reload", `#${source.id}`);
    list.setAttribute("form", form.id);
    list.setAttribute("name", submissionName(widget.reorderable?.name ?? "ids", operation.valuesPath));
    source.setAttribute("data-navigation-order-source", "");
    list.setAttribute("order-items-path", widget.source.itemsPath ?? "");
    list.setAttribute("order-row-key", widget.rowKey);
    (owner ?? list).append(form);
    return true;
}
