import type { Source } from "@bernouy/cms-sources";
import type {
    DashboardCreateOperation,
    DashboardDto,
    DashboardField,
    DashboardWidget,
} from "../../../../interfaces/Dashboard";
import { DASHBOARD_MODAL_FIELD_TYPES } from "../../../../interfaces/dashboard/forms";
import { validateField } from "../../fields";
import { isRecord, validateRequiredId } from "../basic";

export function validateOperationFields(
    fields: DashboardField[],
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    if (!Array.isArray(fields)) {
        errors.push(`${path} must be an array`);
        return;
    }
    const ids = new Set<string>();
    const visibilityIds = new Set(fields.map((field) => field.id));
    fields.forEach((field, index) => {
        validateModalFieldSupport(field, `${path}.${index}`, errors);
        validateField(field, `${path}.${index}`, dashboard, source, ids, errors, visibilityIds);
    });
}

export function validateCreateOperation(
    create: DashboardCreateOperation,
    path: string,
    dashboard: DashboardDto,
    errors: string[],
): void {
    if (!isRecord(create)) {
        errors.push(`${path} must be an object`);
        return;
    }
    validateDetailOpenRef(create, path, dashboard, errors, true);
}

export function validateDetailOpenRef(
    reference: DashboardCreateOperation,
    path: string,
    dashboard: DashboardDto,
    errors: string[],
    creating: boolean,
): void {
    if (!isRecord(reference)) {
        errors.push(`${path} must be an object`);
        return;
    }
    for (const key of [
        "endpoint",
        "sourceId",
        "source",
        "fields",
        "body",
        "params",
        "mode",
        "opens",
        "rowPath",
        "hiddenFields",
        "valuesPath",
        "submitLabel",
        "refresh",
    ]) {
        if (Object.hasOwn(reference, key)) {
            errors.push(`${path}.${key} is not supported: reference a detail view`);
        }
    }
    validateRequiredId(`${path}.viewId`, reference.viewId, errors);
    if (reference.dashboardId !== undefined) {
        validateRequiredId(`${path}.dashboardId`, reference.dashboardId, errors);
    }
    if (reference.presentation !== "page" && reference.presentation !== "modal") {
        errors.push(`${path}.presentation must be page or modal`);
    }
    for (const key of ["title", "label"] as const) {
        if (reference[key] !== undefined && (typeof reference[key] !== "string" || !reference[key].trim())) {
            errors.push(`${path}.${key} must be a non-empty string`);
        }
    }
    // Cross-dashboard mounts are resolved against the installed dashboard catalogue at runtime.
    if (reference.dashboardId && reference.dashboardId !== dashboard.id) {
        return;
    }
    const target = detailTarget(dashboard.views, reference.viewId);
    if (!target) {
        errors.push(`${path}.viewId references unknown detail view "${reference.viewId}"`);
    } else if (!target.save || (creating && !target.create)) {
        errors.push(`${path}.viewId must reference a detail with save${creating ? " and create" : ""}`);
    }
}

function detailTarget(
    widgets: DashboardWidget[],
    id: string,
): Extract<DashboardWidget, { widget: "w-detail" }> | undefined {
    for (const widget of Array.isArray(widgets) ? widgets : []) {
        if (widget.widget === "w-detail" && widget.id === id) {
            return widget;
        }
        const children =
            widget.widget === "w-section"
                ? widget.children
                : widget.widget === "w-tabs"
                  ? widget.tabs.flatMap((tab) => tab.children)
                  : [];
        const found = detailTarget(children, id);
        if (found) {
            return found;
        }
    }
    return undefined;
}

export function validateModalFieldSupport(field: DashboardField, path: string, errors: string[]): void {
    if (!(DASHBOARD_MODAL_FIELD_TYPES as readonly string[]).includes(field.type)) {
        errors.push(`${path}.type is not supported by modal forms yet`);
    }
    if (field.visibleWhen !== undefined) {
        errors.push(`${path}.visibleWhen is not supported by modal forms yet`);
    }
    if ((field.type === "combobox" || field.type === "tokens") && field.lookup !== undefined) {
        errors.push(`${path}.lookup is not supported by modal forms yet; use static options`);
    }
}
