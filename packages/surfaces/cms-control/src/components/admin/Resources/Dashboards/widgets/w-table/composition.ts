import { refreshSourceContext, setSourceContext } from "@bernouy/components";
import type { DashboardWidget } from "@bernouy/cms-dashboards";
import { DashboardWTable } from "./WTable";
import { setP9rButtonLabel, setP9rButtonTone } from "../shared";
import controls from "cms-control/static/admin/_content/sources/_runtime/table.html" with { type: "text" };
import "./presentation/Filters";
import "./presentation/Filter";

export type TableWidget = Extract<DashboardWidget, { widget: "w-table" }>;
const filterStates = new WeakMap<HTMLElement, { values: Record<string, string> }>();

/** Compose definition metadata once; the source applies rows and filter values. */
export function tableShell(widget: TableWidget, filters: Record<string, string> = {}): DashboardWTable {
    const table = new DashboardWTable();
    table.dataset.widgetId = widget.id;
    table.setAttribute("heading", widget.title ?? widget.source.endpoint ?? widget.id);
    table.style.setProperty(
        "--dashboard-table-columns",
        ["46px", ...widget.columns.map((column) => column.width ?? "minmax(7rem, 1fr)")].join(" "),
    );
    const state = { values: filters };
    filterStates.set(table, state);
    setSourceContext(table, () => ({ tableFilters: state.values }));
    for (const column of widget.columns) {
        const header = fragment("column").firstElementChild! as HTMLElement;
        header.dataset.columnHeader = column.id;
        header.textContent = column.label;
        table.append(header);
    }
    for (const action of widget.actions ?? []) {
        const button = fragment("action").firstElementChild! as HTMLElement;
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
        table.append(button);
    }
    if (widget.filters?.length) {
        const form = fragment("filters");
        const layout = form.querySelector("cms-dashboard-table-filters")!;
        for (const filter of widget.filters) {
            const field = fragment(filter.type === "select" ? "select" : "text").firstElementChild! as HTMLElement;
            field.setAttribute("label", filter.label);
            const control = field.querySelector<HTMLInputElement | HTMLSelectElement>("input, select")!;
            control.name = filter.id;
            control.dataset.filterId = filter.id;
            control.setAttribute("aria-label", filter.label);
            control.setAttribute("value", `{{ tableFilters.${filter.id} }}`);
            if (filter.placeholder) {
                control.setAttribute("placeholder", filter.placeholder);
            }
            if (filter.type === "select") {
                for (const option of filter.options ?? []) {
                    const element = document.createElement("option");
                    element.value = option.value;
                    element.textContent = option.label;
                    control.append(element);
                }
            }
            layout.append(field);
        }
        table.append(form);
    }
    return table;
}

export function updateTableFilters(table: HTMLElement, filters: Record<string, string>): void {
    const state = filterStates.get(table);
    if (!state || JSON.stringify(state.values) === JSON.stringify(filters)) {
        return;
    }
    state.values = filters;
    refreshSourceContext(table);
}

function fragment(kind: string): DocumentFragment {
    const template = document.createElement("template");
    template.innerHTML = controls as unknown as string;
    return template.content
        .querySelector<HTMLTemplateElement>(`[data-table-control="${kind}"]`)!
        .content.cloneNode(true) as DocumentFragment;
}
