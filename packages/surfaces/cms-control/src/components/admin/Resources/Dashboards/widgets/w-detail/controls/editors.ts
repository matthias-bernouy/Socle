import type { WDetailTableColumn } from "../types";
import { isTokenControl, isValueControl } from "./shared";

export function readTableEditor(column: WDetailTableColumn, control: HTMLElement): unknown {
    if (column.editable !== true) {
        return undefined;
    }
    if (column.type === "tokens") {
        return isTokenControl(control) ? [...control.values] : [];
    }
    return isValueControl(control) ? control.value : "";
}
