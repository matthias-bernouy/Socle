import type { DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../../domain";
import type { DashboardWDetail } from "../../../../../widgets/w-detail/WDetail";
import { valueAt } from "../../../../expressions";
import { formPart } from "../composition";
import { openDetailView } from "./open";

export function composeLookupCreation(
    host: DashboardWDetail,
    widget: Extract<DashboardWidget, { widget: "w-detail" }>,
    context: RenderContext,
): void {
    const fields = [...widget.main, ...(widget.aside ?? [])].flatMap((section) =>
        "fields" in section ? section.fields : [],
    );
    for (const field of fields) {
        if ((field.type !== "combobox" && field.type !== "tokens") || !field.lookup) {
            continue;
        }
        for (const kind of ["create", "edit"] as const) {
            const ref = field.lookup[kind];
            if (!ref) {
                continue;
            }
            const button = formPart<HTMLElement>(`lookup-${kind}`);
            const label = ref.title ?? ref.label ?? `${kind === "create" ? "Create" : "Edit"} ${field.label}`;
            button.setAttribute("aria-label", label);
            button.setAttribute("title", label);
            button.dataset.lookupAction = `${field.id}:${kind}`;
            const control = Array.from(host.querySelectorAll<HTMLElement>("[data-field-control]")).find(
                (node) => node.dataset.fieldControl === field.id,
            );
            control?.append(button);
            if (kind === "edit") {
                button.setAttribute("cms-bind-boolean-disabled", `!detailValues.${field.path}`);
            }
            // Delegate on the stable source host: binding may instantiate conditional fields.
            host.addEventListener("click", (event) => {
                const clicked = event
                    .composedPath()
                    .find((node) => node instanceof HTMLElement && node.dataset.lookupAction === `${field.id}:${kind}`);
                if (!(clicked instanceof HTMLElement) || clicked.closest("cms-dashboard-w-detail") !== host) {
                    return;
                }
                const current = host.currentFieldValues()[field.id];
                if (kind === "edit" && (current == null || current === "" || Array.isArray(current))) {
                    return;
                }
                openDetailView(host, ref, context, {
                    ...(kind === "edit" ? { row: String(current) } : {}),
                    saved: (resource) => {
                        const value = valueAt(resource, ref.valuePath);
                        if (value == null) {
                            return;
                        }
                        const label = valueAt(resource, ref.labelPath);
                        host.applyLookupCreate(field.id, String(value), {
                            value: String(value),
                            label: String(label ?? value),
                        });
                    },
                });
            });
        }
    }
}
