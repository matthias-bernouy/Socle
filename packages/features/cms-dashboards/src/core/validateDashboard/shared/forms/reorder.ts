import type { DashboardNavigationListWidget } from "../../../../interfaces/dashboard/widgets";
import { formNameSegments, validateFormNames } from "./paths";

export function validateNavigationOrder(widget: DashboardNavigationListWidget, path: string, errors: string[]): void {
    if (!widget.reorderable) {
        return;
    }
    const action = widget.actions?.find((item) => item.id === widget.reorderable!.action);
    if (!action) {
        errors.push(`${path}.reorderable.action references unknown action "${widget.reorderable.action}"`);
        return;
    }
    if (!action.form && !action.endpoint) {
        errors.push(`${path}.reorderable.action must declare an endpoint or form`);
    }
    if (widget.reorderable.name !== undefined && (!action.form || !formNameSegments(widget.reorderable.name))) {
        errors.push(`${path}.reorderable.name requires a form and a safe control name`);
    }
    if (action.form) {
        validateFormNames(
            action.form,
            [{ id: "order", path: "order", name: widget.reorderable.name ?? "ids", type: "tokens", label: "Order" }],
            `${path}.reorderable.action.form`,
            errors,
        );
    }
    if (
        action.form &&
        (action.form.fields?.length ||
            action.form.confirm ||
            action.confirm ||
            action.after ||
            action.form.refresh === "none")
    ) {
        errors.push(
            `${path}.reorderable.action.form submits only the list order and technical fields and must reload its source`,
        );
    }
}
