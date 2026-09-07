import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../../domain";
import { formPart } from "../composition";
import { openDetailView } from "./open";
export { composeLookupCreation } from "./lookup";

export function composeCreation(
    host: HTMLElement,
    widget: Extract<DashboardWidget, { widget: "w-table" | "w-navigation-list" }>,
    context: RenderContext,
    owner: HTMLElement = host,
): void {
    const create = widget.create;
    if (!create) {
        return;
    }
    const button = formPart<HTMLElement>("view-opener");
    button.slot = "actions";
    button.textContent = create.label ?? "Create";
    button.dataset.viewCreate = widget.id;
    owner.addEventListener("click", (event) => {
        const button = event
            .composedPath()
            .find((node) => node instanceof HTMLElement && node.dataset.viewCreate === widget.id);
        if (
            button instanceof HTMLElement &&
            button.closest("[data-widget-id]")?.getAttribute("data-widget-id") === widget.id
        ) {
            openDetailView(owner, create, context);
        }
    });
    host.append(button);
}
