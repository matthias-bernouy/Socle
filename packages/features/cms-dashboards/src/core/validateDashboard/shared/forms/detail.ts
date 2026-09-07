import type { Source } from "@bernouy/cms-sources";
import type { DashboardDto, DashboardWidget } from "../../../../interfaces/Dashboard";
import { isRecord, validateRequiredPath } from "../basic";
import { validateFormOperation } from "./operation";

export function validateDetailForms(
    widget: Extract<DashboardWidget, { widget: "w-detail" }>,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    const sections = [
        ...(Array.isArray(widget.main) ? widget.main : []),
        ...(Array.isArray(widget.aside) ? widget.aside : []),
    ];
    const editableFields = sections.flatMap((section) =>
        "fields" in section && Array.isArray(section.fields) ? section.fields : [],
    );
    if (widget.create !== undefined) {
        if (!isRecord(widget.create)) {
            errors.push(`${path}.create must be an object`);
        } else {
            for (const key of Object.keys(widget.create)) {
                if (key !== "title" && key !== "label") {
                    errors.push(`${path}.create.${key} is not supported by detail creation`);
                } else if (typeof widget.create[key] !== "string" || !widget.create[key].trim()) {
                    errors.push(`${path}.create.${key} must be a non-empty string`);
                }
            }
        }
        if (!widget.save) {
            errors.push(`${path}.save is required for detail creation`);
        }
    }
    if (widget.save !== undefined) {
        validateFormOperation(widget.save, `${path}.save`, dashboard, source, errors, editableFields);
        if (widget.save?.idPath !== undefined) {
            validateRequiredPath("idPath", widget.save.idPath, `${path}.save`, errors);
        }
        if (widget.save?.refresh !== undefined && widget.save.refresh !== "read") {
            errors.push(`${path}.save.refresh must be read: saving reloads the common source`);
        }
    }
    if (widget.delete !== undefined) {
        validateFormOperation(widget.delete, `${path}.delete`, dashboard, source, errors);
        if (typeof widget.delete?.confirm !== "string" || !widget.delete.confirm.trim()) {
            errors.push(`${path}.delete.confirm is required`);
        }
    }
    if (!widget.save && editableFields.some((field) => field.type === "media" && field.persist === "save")) {
        errors.push(`${path}.save is required for media persisted on save`);
    }
}
