import { readSourceData, showToast } from "@bernouy/components";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../../domain";
import type { DashboardWTable } from "../../../../../widgets/w-table/WTable";
import { itemsFrom } from "../../../../source";
import { valueAt } from "../../../../expressions";
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
        const { modal, form, opener } = operationModal(operation, context, "detailResource");
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
        const capture = trackOperationCompletion(table, form.id, () => {
            table.querySelector(`[id="${modal.id}"]`)?.removeAttribute("open");
            showToast("Operation completed", { type: "success" });
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
                capture();
            },
            true,
        );
        table.append(trigger, content);
    }
}
