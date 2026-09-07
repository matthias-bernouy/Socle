import type {
    DashboardActionForm,
    DashboardCreateOperation,
    DashboardDetailCreation,
    DashboardDeleteOperation,
    DashboardFormHiddenField,
    DashboardFormOperation,
    DashboardSaveOperation,
} from "@bernouy/cms-dashboards";
import { IntegrationInputError } from "../../../errors";
import { isRecord } from "../../definition/values";
import { optionalText, requiredText } from "../common";
import { parseModalFields } from "./fields/modalFields";

export function parseFormOperation(value: unknown, name: string): DashboardFormOperation {
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be an object");
    }
    for (const key of ["body", "params", "management"]) {
        if (Object.hasOwn(value, key)) {
            throw new IntegrationInputError(`${name}.${key}`, "is not supported by form operations");
        }
    }
    const result: DashboardFormOperation = { endpoint: requiredText(value.endpoint, `${name}.endpoint`) };
    for (const key of ["sourceId", "label", "icon", "confirm", "valuesPath"] as const) {
        const parsed = optionalText(value[key], `${name}.${key}`);
        if (parsed !== undefined) {
            result[key] = parsed;
        }
    }
    if (value.tone !== undefined) {
        if (value.tone !== "primary" && value.tone !== "secondary" && value.tone !== "danger") {
            throw new IntegrationInputError(`${name}.tone`, "must be primary, secondary, or danger");
        }
        result.tone = value.tone;
    }
    if (value.refresh !== undefined) {
        if (value.refresh !== "read" && value.refresh !== "none") {
            throw new IntegrationInputError(`${name}.refresh`, "must be read or none");
        }
        result.refresh = value.refresh;
    }
    if (value.hiddenFields !== undefined) {
        result.hiddenFields = parseHiddenFields(value.hiddenFields, `${name}.hiddenFields`);
    }
    return result;
}

export function parseHiddenFields(value: unknown, name: string): DashboardFormHiddenField[] {
    if (!Array.isArray(value)) {
        throw new IntegrationInputError(name, "must be an array");
    }
    return value.map((field, index) => {
        const path = `${name}.${index}`;
        if (!isRecord(field)) {
            throw new IntegrationInputError(path, "must be an object");
        }
        if (field.type !== "string" && field.type !== "number" && field.type !== "boolean") {
            throw new IntegrationInputError(`${path}.type`, "must be string, number, or boolean");
        }
        if (
            !["string", "number", "boolean"].includes(typeof field.value) ||
            (typeof field.value === "number" && !Number.isFinite(field.value))
        ) {
            throw new IntegrationInputError(`${path}.value`, "must be a finite scalar");
        }
        if (field.empty !== undefined && field.empty !== "omit") {
            throw new IntegrationInputError(`${path}.empty`, "must be omit");
        }
        return {
            ...(field.empty === "omit" ? { empty: "omit" as const } : {}),
            name: requiredText(field.name, `${path}.name`),
            value: field.value as string | number | boolean,
            type: field.type,
        };
    });
}

export function parseActionForm(value: unknown, name: string): DashboardActionForm {
    const form = parseFormOperation(value, name);
    const record = value as Record<string, unknown>;
    return {
        ...form,
        ...(record.fields !== undefined ? { fields: parseModalFields(record.fields, `${name}.fields`) } : {}),
    };
}

export function parseDeleteOperation(value: unknown, name: string): DashboardDeleteOperation {
    const form = parseFormOperation(value, name);
    return { ...form, confirm: requiredText(form.confirm, `${name}.confirm`) };
}

export function parseCreateOperation(value: unknown, name: string): DashboardCreateOperation {
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be an object");
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
        if (Object.hasOwn(value, key)) {
            throw new IntegrationInputError(`${name}.${key}`, "is not supported: reference a detail view");
        }
    }
    if (value.presentation !== "page" && value.presentation !== "modal") {
        throw new IntegrationInputError(`${name}.presentation`, "must be page or modal");
    }
    const result: DashboardCreateOperation = {
        viewId: requiredText(value.viewId, `${name}.viewId`),
        presentation: value.presentation,
    };
    for (const key of ["dashboardId", "label", "title"] as const) {
        const parsed = optionalText(value[key], `${name}.${key}`);
        if (parsed !== undefined) {
            result[key] = parsed;
        }
    }
    return result;
}

export function parseDetailCreation(value: unknown, name: string): DashboardDetailCreation {
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be an object");
    }
    const result: DashboardDetailCreation = {};
    for (const key of Object.keys(value)) {
        if (key !== "label" && key !== "title") {
            throw new IntegrationInputError(`${name}.${key}`, "is not supported by detail creation");
        }
        result[key] = requiredText(value[key], `${name}.${key}`);
    }
    return result;
}

export function parseSaveOperation(value: unknown, name: string): DashboardSaveOperation {
    const form = parseFormOperation(value, name);
    if (form.refresh !== undefined && form.refresh !== "read") {
        throw new IntegrationInputError(`${name}.refresh`, "must be read: saving reloads the common source");
    }
    const { refresh, ...operation } = form;
    return {
        ...operation,
        ...(refresh ? { refresh } : {}),
        ...((value as Record<string, unknown>).idPath !== undefined
            ? { idPath: requiredText((value as Record<string, unknown>).idPath, `${name}.idPath`) }
            : {}),
    };
}
