import { setSourceData } from "@bernouy/components";
import { tableShell, type TableWidget } from "../../widgets/w-table/composition";
import { tableRowsTemplate } from "./mountSource";

export function tableWithSource(widget: TableWidget, source: HTMLElement, filters: Record<string, string> = {}) {
    const table = tableShell(widget, filters);
    for (const name of ["cms-source", "cms-reload-on"]) {
        const value = source.getAttribute(name);
        if (value !== null) {
            table.setAttribute(name, value);
        }
    }
    table.append(...Array.from(source.childNodes), tableRowsTemplate(widget));
    if (!table.hasAttribute("cms-source")) {
        table.setAttribute("cms-source", "");
        setSourceData(table, {});
    }
    return table;
}
