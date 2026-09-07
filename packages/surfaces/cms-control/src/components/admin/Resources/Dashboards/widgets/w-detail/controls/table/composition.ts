import type { DashboardField } from "@bernouy/cms-dashboards";
import markup from "cms-control/static/admin/_content/sources/_runtime/detail/table.html" with { type: "text" };
import { lookupSource } from "../../lookups/composition";
import "./Field";

/** Compose column definitions once; binding applies rows and shared lookup options. */
export function composeTable(control: HTMLElement, field: Extract<DashboardField, { type: "table" }>): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    const clone = (name: string) =>
        template.content
            .querySelector<HTMLTemplateElement>(`[data-table-template="${name}"]`)!
            .content.firstElementChild!.cloneNode(true) as HTMLElement;
    control.setAttribute("data-table-editable", String(field.editable === true));
    control.style.setProperty(
        "--detail-table-columns",
        [
            ...field.columns.map((column) => column.width ?? "minmax(8rem, 1fr)"),
            ...(field.editable ? ["72px"] : []),
        ].join(" "),
    );
    const head = clone("head");
    const row = clone("row");
    row.setAttribute("cms-repeat", `detailTables.${field.id} as tableRow`);
    row.toggleAttribute("data-readonly", !field.editable);

    for (const [index, column] of field.columns.entries()) {
        const heading = clone("cell");
        heading.textContent = column.label;
        head.append(heading);
        if (field.editable && column.editable) {
            const editor = clone(column.type ?? "text");
            editor.setAttribute("data-table-column", column.id);
            editor.setAttribute("aria-label", column.label);
            editor.setAttribute("value", `{{ tableRow.cells.${column.id} }}`);
            if (column.type === "select" || column.type === "combobox") {
                for (const item of column.options ?? []) {
                    const option = document.createElement("option");
                    option.value = item.value;
                    option.textContent = item.label;
                    editor.append(option);
                }
            }
            if (column.type === "combobox" && column.lookup) {
                const source = lookupSource(column.lookup, `${field.id}.${column.id}`, "detailTableLookupUrls");
                const scope = `tableLookup_${field.id}_${index}`;
                source.setAttribute("context-name", scope);
                source.setAttribute("table-column", column.id);
                const declared = document.createElement("span");
                declared.hidden = true;
                declared.setAttribute("data-static-options", "");
                declared.append(...Array.from(editor.children));
                source.hidden = true;
                source.append(declared);
                control.append(source);
                const option = clone("option");
                option.setAttribute("cms-repeat", `${scope}.lookupOptions as tableOption`);
                editor.append(option);
                editor.toggleAttribute("remote-search", Boolean(source.getAttribute("search-params")));
                editor.setAttribute("loading", `{{ ${scope}.lookupLoading }}`);
                editor.setAttribute("has-more", `{{ ${scope}.lookupHasMore }}`);
            }
            row.append(editor);
        } else {
            const cell = clone("cell");
            cell.textContent = `{{ tableRow.cells.${column.id} }}`;
            row.append(cell);
        }
    }
    if (field.editable) {
        head.append(clone("cell"));
        row.append(clone("remove"));
    }
    control.append(head, row);
    if (field.editable) {
        const add = clone("add");
        add.textContent = field.addLabel ?? "Add row";
        control.append(add);
    }
    return control;
}
