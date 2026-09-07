import { setP9rButtonTone } from "../../../../widgets/shared";
import type { DashboardField, DashboardFormOperation } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../domain";
import { fieldElement } from "../../../../widgets/w-detail/binding/fields";
import { configureForm, formId, formPart } from "./composition";

export function operationModal(
    operation: DashboardFormOperation & { fields?: DashboardField[]; title?: string; submitLabel?: string },
    context: RenderContext,
) {
    const modal = formPart<HTMLElement>("modal");
    modal.id = formId();
    const title = operation.title ?? operation.label ?? "Confirm operation";
    modal.setAttribute("aria-label", title);
    modal.querySelector('[slot="title"]')!.textContent = title;
    const form = modal.querySelector("form")!;
    form.dataset.operationForm = "";
    configureForm(form, operation, context);
    const stack = form.querySelector("[data-operation-fields]")!;
    if (operation.confirm) {
        const confirmation = document.createElement("p");
        confirmation.textContent = operation.confirm;
        stack.append(confirmation);
    }
    for (const field of operation.fields ?? []) {
        stack.append(fieldElement(field, "operationDefaults", operation));
    }
    const submit = formPart<HTMLElement>("submit");
    setP9rButtonTone(submit, operation.tone ?? "primary");
    submit.textContent = operation.submitLabel ?? operation.label ?? "Create";
    stack.append(submit);
    const opener = formPart<HTMLElement>("opener");
    opener.setAttribute("modal-target", modal.id);
    opener.querySelector("p9r-button")!.textContent = operation.label ?? title;
    setP9rButtonTone(opener.querySelector("p9r-button")!, operation.tone ?? "secondary");
    return { modal, form, opener };
}
