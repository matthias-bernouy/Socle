import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { DetailSelection, RenderContext } from "../../domain";
import { DashboardWNavigationList } from "../../widgets/w-navigation-list/WNavigationList";
import { navigationItemsTemplate, requiredSourceParams, sourceWrapper } from "./mountSource";

export function navigationListElement(
    widget: Extract<DashboardWidget, { widget: "w-navigation-list" }>,
    context: RenderContext,
    detail: DetailSelection | null,
    slot?: string,
): HTMLElement {
    const wrapper = sourceWrapper(
        context.dashboard.source,
        widget.source,
        selectionVars(detail),
        "dashboardData",
        requiredSourceParams(context, widget.source),
    );
    const element = new DashboardWNavigationList();
    if (slot) {
        element.setAttribute("slot", slot);
    }
    element.configure(widget);
    wrapper.append(navigationItemsTemplate(widget));
    element.append(wrapper);
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
