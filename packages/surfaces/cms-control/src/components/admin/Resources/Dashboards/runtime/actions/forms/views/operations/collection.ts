import { WIDGET_ROW_SELECT_EVENT, emitWidgetEvent } from "../../../../../widgets/shared";
import { readSourceData, showToast } from "@bernouy/components";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../../domain";
import type { DashboardWTable } from "../../../../../widgets/w-table/WTable";
import { itemsFrom } from "../../../../source";
import { resolveExpression, valueAt } from "../../../../expressions";
import { formId } from "../composition";
import { hasMissingTechnicalFields } from "../technicalFields";
import { operationModal } from "../modal";
import { OPERATION_AWAITING_READ, trackOperationCompletion } from "./completion";

/** A table action submits the single selected row through its own bound form. */
export function composeTableOperations(
    table: DashboardWTable,
    widget: Extract<DashboardWidget, { widget: "w-table" }>,
    context: RenderContext,
): void {
    table.id ||= formId();
    for (const action of widget.actions ?? []) {
        if (!action.form) {
            continue;
        }
        const operation = { label: action.label, tone: action.tone, confirm: action.confirm, ...action.form };
        const { modal, form, opener } = operationModal(operation, context, `tableOperations.${action.id}.resource`);
        const confirmation = Boolean(operation.confirm || operation.fields?.length);
        const trigger = confirmation ? opener : form.querySelector<HTMLElement>('[type="submit"]')!;
        trigger.slot = "actions";
        if (!confirmation) {
            trigger.setAttribute("form", form.id);
        }
        const content = confirmation ? modal : form;
        content.slot = "footer";
        if (operation.refresh !== "none") {
            form.setAttribute("cms-source-success-reload", `#${table.id}`);
        }
        let selectedKey = "";
        const capture = trackOperationCompletion(table, form.id, (body) => {
            table.querySelector(`[id="${modal.id}"]`)?.removeAttribute("open");
            showToast("Operation completed", { type: "success" });
            if (action.after?.opens) {
                const row = action.after.row
                    ? resolveExpression(action.after.row, { result: body, selection: { id: selectedKey } })
                    : selectedKey;
                if ((typeof row === "string" || typeof row === "number") && String(row)) {
                    emitWidgetEvent(table, WIDGET_ROW_SELECT_EVENT, {
                        collection: action.after.opens,
                        rowKey: String(row),
                    });
                }
            }
        });
        table.addEventListener(
            "submit",
            (event) => {
                if ((event.target as Element).id !== form.id) {
                    return;
                }
                const keys = table.selectedKeys;
                const current =
                    keys.length === 1 &&
                    itemsFrom(readSourceData(table), widget.source).some(
                        (row) => String(valueAt(row, widget.rowKey)) === keys[0],
                    );
                if (
                    !current ||
                    hasMissingTechnicalFields(event.target as HTMLFormElement) ||
                    table.hasAttribute(OPERATION_AWAITING_READ)
                ) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    showToast(
                        table.hasAttribute(OPERATION_AWAITING_READ)
                            ? "The operation completed. Retry the list read before submitting again."
                            : "Select exactly one available row before running this operation.",
                        { type: "warning" },
                    );
                    return;
                }
                selectedKey = keys[0]!;
                capture();
            },
            true,
        );
        table.append(trigger, content);
    }
}
