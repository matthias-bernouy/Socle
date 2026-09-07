import { validateDetailOpenRef } from "./shared/forms/creation";
import type { Source } from "@bernouy/cms-sources";
import type { DashboardDto, DashboardField, DashboardLookupRef } from "../../interfaces/Dashboard";
import { validateEmbeddedLookupRef } from "./endpointRefs";
import { isRecord, validateOptions, validatePath, validateRequiredPath } from "./shared";

export function validateSelectableField(
    field: Extract<DashboardField, { type: "combobox" | "tokens" }>,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    const hasOptions = Array.isArray(field.options) && field.options.length > 0;
    const hasLookup = field.lookup !== undefined;
    if (!hasOptions && !hasLookup && field.allowCustom !== true) {
        errors.push(`${path} must declare options, lookup, or allowCustom`);
    }
    if (field.options !== undefined) {
        validateOptions(field.options, `${path}.options`, errors);
    }
    if (field.lookup) {
        validateLookup(field.lookup, `${path}.lookup`, dashboard, source, errors);
    }
}

function validateLookup(
    lookup: DashboardLookupRef,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    validateEmbeddedLookupRef(dashboard, lookup, path, source, errors);
    lookup.descriptionPaths?.forEach((entry, index) =>
        validatePath(`${index}`, entry, `${path}.descriptionPaths`, errors),
    );
    for (const key of ["create", "edit"] as const) {
        const reference = lookup[key];
        if (reference === undefined) {
            continue;
        }
        validateDetailOpenRef(reference, `${path}.${key}`, dashboard, errors, key === "create");
        if (!isRecord(reference)) {
            continue;
        }
        if (reference.presentation !== "modal") {
            errors.push(`${path}.${key}.presentation must be modal for lookup details`);
        }
        validateRequiredPath("valuePath", reference.valuePath, `${path}.${key}`, errors);
        validateRequiredPath("labelPath", reference.labelPath, `${path}.${key}`, errors);
    }
}
