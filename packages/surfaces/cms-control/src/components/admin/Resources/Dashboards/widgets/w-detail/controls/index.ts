import type { WDetailField, WDetailFieldValue } from "../types";
import { validateReorderable } from "../../w-reorderable-list/binding/validation";
import { readBoundTableRows } from "./table/context";
import { isMediaControl, mediaList } from "../mediaControl";
import { createBasicControl, fieldUsesBasicInternalLabel, readBasicControlValue } from "./basic";
import { createSchemaControl, readSchemaControlValue, validateSchemaControl } from "./schema";
import {
    createReorderableListControl,
    createTableControl,
    isReorderableListControl,
    readTableValue,
    tableRow,
} from "./table";

export function createFieldControl(field: WDetailField): HTMLElement {
    if (field.input === "media-list") {
        return mediaList(field);
    }
    if (field.input === "table") {
        return createTableControl(field);
    }
    if (field.input === "reorderable-list") {
        return createReorderableListControl(field);
    }
    if (field.input === "schema") {
        return createSchemaControl(field);
    }
    return createBasicControl(field);
}

export function fieldUsesInternalLabel(field: WDetailField): boolean {
    return (
        field.input === "media-list" ||
        field.input === "reorderable-list" ||
        field.input === "schema" ||
        fieldUsesBasicInternalLabel(field)
    );
}

export function readFieldControlValue(field: WDetailField, control: HTMLElement): WDetailFieldValue {
    if (field.input === "reorderable-list" && control.localName === "cms-dashboard-reorderable-field") {
        return (control as HTMLElement & { items: Record<string, unknown>[] }).items;
    }
    if (field.input === "media-list" && isMediaControl(control)) {
        return control.items;
    }
    if (field.input === "table") {
        return readTableValue(field, control);
    }
    if (field.input === "reorderable-list" && isReorderableListControl(control)) {
        return control.items;
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

export { tableRow };
