import type { WDetailField, WDetailFieldValue } from "../types";
import { validateReorderable } from "../../w-reorderable-list/binding/validation";
import { readBoundTableRows, serializedTableRows } from "./table/context";
import { isMediaControl } from "../mediaControl";
import { readBasicControlValue } from "./basic";
import { readSchemaControlValue, validateSchemaControl } from "./schema/runtime";

export function readFieldControlValue(field: WDetailField, control: HTMLElement): WDetailFieldValue {
    if (field.input === "reorderable-list" && control.localName === "cms-dashboard-reorderable-field") {
        return (control as HTMLElement & { items: Record<string, unknown>[] }).items;
    }
    if (field.input === "media-list" && isMediaControl(control)) {
        return control.items;
    }
    if (field.input === "table") {
        const rows = readBoundTableRows(field, control);
        return field.editable ? serializedTableRows(rows) : rows;
    }
    if (field.input === "schema") {
        return readSchemaControlValue(field, control);
    }
    return readBasicControlValue(field, control);
}

/** Drafts retain blank added rows until submission; operation values omit them. */
export function readFieldControlDraft(field: WDetailField, control: HTMLElement): WDetailFieldValue {
    return field.input === "table" && control.localName === "cms-dashboard-table-field"
        ? readBoundTableRows(field, control)
        : readFieldControlValue(field, control);
}

export function invalidFieldControl(field: WDetailField, control: HTMLElement): HTMLElement | null {
    if (field.input === "reorderable-list" && control.localName === "cms-dashboard-reorderable-field") {
        return validateReorderable(control) ?? (control.hasAttribute("invalid") ? control : null);
    }
    if (field.input === "schema") {
        return validateSchemaControl(field, control) ?? (control.hasAttribute("invalid") ? control : null);
    }
    return control.hasAttribute("invalid") ? control : null;
}
