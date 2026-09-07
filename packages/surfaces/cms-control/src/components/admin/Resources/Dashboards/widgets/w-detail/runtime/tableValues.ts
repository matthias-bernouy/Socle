import { deriveTableRows } from "../controls/table/derive";
import { readBoundTableRows } from "../controls/table/context";
import { readFieldControlValue } from "../controls";
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
    const rows = [...readBoundTableRows(field, control), {}];
    emitFieldChange(control, rows);
    updateDerivedTables(field.id, fields, rows);
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
    const field = fields.find(control.dataset.fieldControl ?? "");
    if (!field) {
        return;
    }
    const rows = readBoundTableRows(field, control);
    rows.splice(Number((row as HTMLElement).dataset.tableIndex), 1);
    emitFieldChange(control, rows);
    updateDerivedTables(field.id, fields, rows);
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
        fields.record(field.id, rows);
    }
}
