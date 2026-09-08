import { makeEndpointUrn, type Source } from "@bernouy/cms-sources";
import type { DashboardDto, DashboardField, DashboardFormOperation } from "../../../../interfaces/Dashboard";
import { isSafeDashboardExpression } from "../../../dashboardPaths";
import { validateEndpointRef } from "../../endpointRefs";
import { isRecord } from "../basic";
import { formNameSegments, validateFormNames } from "./paths";

export function validateFormOperation(
    operation: DashboardFormOperation,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
    fields: DashboardField[] = [],
): void {
    if (!isRecord(operation)) {
        errors.push(`${path} must be an object`);
        return;
    }
    validateEndpointRef(dashboard, operation, path, source, errors);
    for (const key of ["body", "params"]) {
        if (Object.hasOwn(operation, key)) {
            errors.push(`${path}.${key} is not supported by form operations`);
        }
    }
    const endpoint =
        source && operation.endpoint && (!operation.sourceId || operation.sourceId === dashboard.source)
            ? source.endpoints.find((entry) => entry.urn === makeEndpointUrn(dashboard.source, operation.endpoint))
            : undefined;
    if (endpoint && !["POST", "PUT", "PATCH", "DELETE"].includes(endpoint.method)) {
        errors.push(`${path}.endpoint must accept a request body`);
    }
    for (const key of ["label", "icon", "confirm"] as const) {
        if (operation[key] !== undefined && (typeof operation[key] !== "string" || !operation[key].trim())) {
            errors.push(`${path}.${key} must be a non-empty string`);
        }
    }
    if (operation.tone !== undefined && !["primary", "secondary", "danger"].includes(operation.tone)) {
        errors.push(`${path}.tone is not supported`);
    }
    if (operation.refresh !== undefined && !["read", "none"].includes(operation.refresh)) {
        errors.push(`${path}.refresh must be read or none`);
    }
    if (operation.valuesPath !== undefined && !formNameSegments(operation.valuesPath)) {
        errors.push(`${path}.valuesPath must be a safe form name`);
    }
    if (operation.hiddenFields !== undefined && !Array.isArray(operation.hiddenFields)) {
        errors.push(`${path}.hiddenFields must be an array`);
        return;
    }
    operation.hiddenFields?.forEach((field, index) => {
        const fieldPath = `${path}.hiddenFields.${index}`;
        if (!isRecord(field)) {
            errors.push(`${fieldPath} must be an object`);
            return;
        }
        if (!["string", "number", "boolean"].includes(field.type)) {
            errors.push(`${fieldPath}.type must be string, number, or boolean`);
        }
        if (field.empty !== undefined && field.empty !== "omit") {
            errors.push(`${fieldPath}.empty must be omit`);
        }
        const expression = typeof field.value === "string" && field.value.startsWith("$");
        if (expression) {
            if (!isSafeDashboardExpression(field.value as string, ["resource", "selection", "row"], true)) {
                errors.push(`${fieldPath}.value must use a stable resource or selection expression`);
            }
        } else if (
            typeof field.value !== field.type ||
            (typeof field.value === "number" && !Number.isFinite(field.value))
        ) {
            errors.push(`${fieldPath}.value must be a scalar matching its type`);
        }
    });
    validateFormNames(operation, fields, path, errors);
}
