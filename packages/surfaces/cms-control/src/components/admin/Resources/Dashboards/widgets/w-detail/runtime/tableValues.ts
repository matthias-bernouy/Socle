import { deriveTableRows } from "../controls/table/derive";
import { readBoundTableRows } from "../controls/table/context";
import { readFieldControlValue, tableRow } from "../controls";
import type { WDetailField } from "../types";
import { DetailFieldState } from "./fieldState";

type EmitFieldChange = (control: HTMLElement, draft?: unknown) => void;

export function toggleChip(chip: HTMLButtonElement, emitFieldChange: EmitFieldChange): void {
    chip.setAttribute("aria-pressed", String(chip.getAttribute("aria-pressed") !== "true"));
    const control = chip.closest<HTMLElement>("[data-field-control]");
    if (control) {
        emitFieldChange(control);
    }
}

export function addTableRow(
    button: HTMLButtonElement,
    fields: DetailFieldState,
    emitFieldChange: EmitFieldChange,
): void {
    const control = button.closest<HTMLElement>("[data-field-control]");
    const field = control ? fields.find(control.dataset.fieldControl ?? "") : undefined;
    if (!control || !field || field.input !== "table") {
        return;
    }
    if (control.localName === "cms-dashboard-table-field") {
        const rows = [...readBoundTableRows(field, control), {}];
        emitFieldChange(control, rows);
        updateDerivedTables(field.id, fields, rows);
        return;
    }
    control.insertBefore(tableRow(field, {}), button);
    emitFieldChange(control);
    updateDerivedTables(field.id, fields);
}

export function removeTableRow(
    button: HTMLButtonElement,
    fields: DetailFieldState,
    emitFieldChange: EmitFieldChange,
): void {
    const control = button.closest<HTMLElement>("[data-field-control]");
    const row = button.closest("[data-table-row]");
    if (!control || !row) {
        return;
    }
    if (control.localName === "cms-dashboard-table-field") {
        const field = fields.find(control.dataset.fieldControl ?? "");
        if (!field) {
            return;
        }
        const rows = readBoundTableRows(field, control);
        rows.splice(Number((row as HTMLElement).dataset.tableIndex), 1);
        emitFieldChange(control, rows);
        updateDerivedTables(field.id, fields, rows);
        return;
    }
    row.remove();
    emitFieldChange(control);
    updateDerivedTables(control.dataset.fieldControl ?? "", fields);
}

export function updateDerivedTables(sourceFieldId: string, fields: DetailFieldState, sourceDraft?: unknown): void {
    const sourceControl = fields.control(sourceFieldId);
    const sourceField = sourceControl ? fields.find(sourceFieldId) : undefined;
    if (!sourceControl || !sourceField) {
        return;
    }
    const sourceValue = sourceDraft ?? readFieldControlValue(sourceField, sourceControl);
    for (const field of fields.fields()) {
        if (field.input !== "table" || field.derive?.sourceField !== sourceFieldId) {
            continue;
        }
        const control = fields.control(field.id);
        if (!control) {
            continue;
        }
        const rows = deriveTableRows(field, sourceValue);
        field.value = rows;
        if (control.localName === "cms-dashboard-table-field") {
            fields.record(field.id, rows);
        } else {
            replaceTableRows(control, field, rows);
        }
    }
}

function replaceTableRows(control: HTMLElement, field: WDetailField, rows: Record<string, unknown>[]): void {
    control.querySelectorAll("[data-table-row]").forEach((row) => row.remove());
    const anchor = control.querySelector("[data-table-add]");
    for (const row of rows) {
        control.insertBefore(tableRow(field, row), anchor);
    }
}
