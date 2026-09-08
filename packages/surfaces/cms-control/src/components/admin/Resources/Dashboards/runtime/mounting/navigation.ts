import { composeNavigationOrder } from "../../widgets/w-navigation-list/order/composition";
import { composeCreation } from "../actions/forms/views/creation";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { DetailSelection, RenderContext } from "../../domain";
import { DashboardWNavigationList } from "../../widgets/w-navigation-list/WNavigationList";
import { navigationItemsTemplate, requiredSourceParams, sourceWrapper } from "./mountSource";
import controls from "cms-control/static/admin/_content/sources/_runtime/navigation-list.html" with { type: "text" };
import { setP9rButtonLabel, setP9rButtonTone } from "../../widgets/shared";

type NavigationListWidget = Extract<DashboardWidget, { widget: "w-navigation-list" }>;

/** Compose declarations from the definition before the source binds its rows. */
export function navigationListShell(widget: NavigationListWidget): DashboardWNavigationList {
    const element = new DashboardWNavigationList();
    element.setAttribute("heading", widget.title ?? "");
    element.setAttribute("widget-id", widget.id);
    element.dataset.widgetId = widget.id;
    if (widget.reorderable) {
        element.setAttribute("reorder-action", widget.reorderable.action);
    }
    const template = document.createElement("template");
    template.innerHTML = controls as unknown as string;
    const actionTemplate = template.content.querySelector<HTMLTemplateElement>("[data-navigation-action]")!;
    for (const action of widget.actions ?? []) {
        if (action.id === widget.reorderable?.action) {
            continue;
        }
        const button = actionTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
        button.dataset.action = action.id;
        button.dataset.widget = widget.id;
        if (action.selection?.opens) {
            button.dataset.target = action.selection.opens;
        }
        if (action.confirm) {
            button.dataset.confirm = action.confirm;
        }
        setP9rButtonTone(button, action.tone ?? "primary");
        setP9rButtonLabel(button, action.label);
        element.append(button);
    }
    return element;
}

export function navigationListElement(
    widget: Extract<DashboardWidget, { widget: "w-navigation-list" }>,
    context: RenderContext,
    detail: DetailSelection | null,
    slot?: string,
    formOwner?: HTMLElement,
): HTMLElement {
    const wrapper = sourceWrapper(
        context.dashboard.source,
        widget.source,
        selectionVars(detail),
        "dashboardData",
        requiredSourceParams(context, widget.source),
    );
    const element = navigationListShell(widget);
    if (slot) {
        element.setAttribute("slot", slot);
    }
    const orderForm = composeNavigationOrder(element, wrapper, widget, context, formOwner);
    wrapper.append(navigationItemsTemplate(widget, orderForm ? "navigationItems" : undefined));
    element.append(wrapper);
    composeCreation(element, widget, context, formOwner);
    return element;
}

export function selectionVars(detail: DetailSelection | null): { selection?: Record<string, unknown> } {
    if (!detail) {
        return {};
    }
    const selected = { id: detail.row };
    return {
        selection: {
            ...selected,
            [detail.collection]: selected,
        },
    };
}
