import { hasMissingTechnicalFields } from "./technicalFields";
import { matchesDashboardVisibility, resolveExpression, valueAt } from "../../../expressions";
import { readSourceData, showToast } from "@bernouy/components";
import { OPERATION_AWAITING_READ, trackOperationCompletion } from "./operationCompletion";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../domain";
import type { DashboardWDetail } from "../../../../widgets/w-detail/WDetail";
import { WIDGET_BACK_EVENT, WIDGET_ROW_SELECT_EVENT, emitWidgetEvent } from "../../../../widgets/shared";
import { operationModal } from "./modal";

/** Independent actions never implicitly save the principal form's draft. */
export function composeDetailOperations(
    host: DashboardWDetail,
    widget: Extract<DashboardWidget, { widget: "w-detail" }>,
    context: RenderContext,
): void {
    const actions = (widget.actions ?? []).flatMap((action) =>
        action.form ? [{ ...action, form: action.form, deleting: false }] : [],
    );
    if (widget.delete) {
        actions.push({ id: "delete", label: widget.delete.label ?? "Delete", form: widget.delete, deleting: true });
    }
    for (const action of actions) {
        const operation = {
            confirm: action.confirm,
            tone: action.tone,
            icon: action.icon,
            ...action.form,
            label: action.form.label ?? action.label,
        };
        const { modal, form, opener } = operationModal(operation, context);
        const confirmation = Boolean(operation.confirm || operation.fields?.length);
        const trigger = confirmation ? opener : form.querySelector<HTMLElement>('[type="submit"]')!;
        trigger.slot = "bound-actions";
        trigger.setAttribute("cms-condition", "detailReady && detailPersisted");
        if (action.visibleWhen) {
            trigger.setAttribute("cms-condition", `detailOperationVisibility.${action.id}`);
        }
        if (!confirmation) {
            trigger.setAttribute("form", form.getAttribute("id")!);
        }
        if (!action.deleting && operation.refresh !== "none") {
            form.setAttribute("cms-source-success-reload", `#${host.id}`);
        }
        const formId = form.getAttribute("id");
        const modalId = modal.id;
        const capture = trackOperationCompletion(host, formId!, (body, rowKey) => {
            host.querySelector(`[id="${modalId}"]`)?.removeAttribute("open");
            const currentForm = host.querySelector<HTMLFormElement>(`[id="${formId}"]`);
            if (currentForm) {
                HTMLFormElement.prototype.reset.call(currentForm);
            }
            if (action.deleting) {
                emitWidgetEvent(host, WIDGET_BACK_EVENT, {});
            } else if (action.after?.opens) {
                const row = action.after.row
                    ? resolveExpression(action.after.row, { result: body, selection: { id: rowKey } })
                    : rowKey;
                if (typeof row === "string" || typeof row === "number") {
                    emitWidgetEvent(host, WIDGET_ROW_SELECT_EVENT, {
                        collection: action.after.opens,
                        rowKey: String(row),
                    });
                }
            }
        });
        host.addEventListener(
            "submit",
            (event) => {
                if ((event.target as Element).closest("cms-dashboard-w-detail") !== host) {
                    return;
                }
                if (host.hasAttribute(OPERATION_AWAITING_READ)) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    showToast(
                        "The operation already completed. Retry the detail read before submitting another form.",
                        { type: "warning" },
                    );
                    return;
                }
                if ((event.target as Element).getAttribute("id") !== formId) {
                    return;
                }
                const data = readSourceData(host);
                const resource = widget.source.itemPath ? valueAt(data, widget.source.itemPath) : data;
                const missing = hasMissingTechnicalFields(event.target as HTMLFormElement);
                const unavailable =
                    resource == null ||
                    !matchesDashboardVisibility(action.visibleWhen, { resource, fields: host.currentFieldValues() });
                const dirty = host.hasUnsavedChanges();
                if (missing || unavailable || dirty) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    showToast(
                        missing
                            ? "The operation identity or revision is missing. Reload the detail."
                            : unavailable
                              ? "This operation is no longer available for the current detail."
                              : "Save or discard the current changes before running this operation.",
                        { type: "warning" },
                    );
                    return;
                }
                capture();
            },
            true,
        );
        const content = confirmation ? modal : form;
        content.slot = "footer";
        host.append(trigger, content);
    }
}
