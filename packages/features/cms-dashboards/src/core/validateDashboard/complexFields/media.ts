import type { Source } from "@bernouy/cms-sources";
import type { DashboardDto, DashboardField } from "cms-dashboards/interfaces/Dashboard";
import { formNameSegments } from "../shared/forms/paths";
import { isRecord } from "../shared/basic";
import { validateEndpointRef } from "../endpointRefs";
import { validatePath, validateRequiredPath } from "../shared";

export function validateMediaField(
    field: Extract<DashboardField, { type: "media" }>,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    validateMediaDefinition(field, path, dashboard, source, errors);
    if (field.persist !== undefined && field.persist !== "save") {
        errors.push(`${path}.persist must be save`);
    }
    if (field.staging !== undefined) {
        if (!isRecord(field.staging) || !formNameSegments(field.staging.sessionField)) {
            errors.push(`${path}.staging.sessionField must be a safe form name`);
        } else if (Object.keys(field.staging).some((key) => key !== "sessionField")) {
            errors.push(`${path}.staging only accepts sessionField`);
        }
        if (field.persist !== "save" || !field.actions?.upload) {
            errors.push(`${path}.staging requires persist save and an upload action`);
        }
    }
    if (field.persist === "save") {
        if (field.actions?.upload && !field.staging) {
            errors.push(`${path}.staging is required for staged uploads`);
        }
        validateRequiredPath("item.idPath", field.item.idPath, path, errors);
        if (field.actions?.upload?.body && Object.keys(field.actions.upload.body).length) {
            errors.push(`${path}.actions.upload.body is not supported by staged file forms`);
        }
        if (field.actions?.remove || field.actions?.reorder || field.actions?.replace) {
            errors.push(`${path}.actions cannot mutate associations when persist is save`);
        }
    }
}

export function validateMediaDefinition(
    field: Pick<Extract<DashboardField, { type: "media" }>, "item" | "actions">,
    path: string,
    dashboard: DashboardDto,
    source: Source | null,
    errors: string[],
): void {
    if (field.item.endpoint !== undefined) {
        validateEndpointRef(dashboard, { endpoint: field.item.endpoint }, `${path}.item`, source, errors);
    }
    validatePath("item.idPath", field.item.idPath, path, errors);
    validateRequiredPath("item.urlPath", field.item.urlPath, path, errors);
    validatePath("item.altPath", field.item.altPath, path, errors);
    if (!field.actions) {
        return;
    }
    for (const [action, reference] of Object.entries(field.actions)) {
        if (reference) {
            validateEndpointRef(dashboard, reference, `${path}.actions.${action}`, source, errors);
        }
    }
}
