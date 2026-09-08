import { parseActionForm } from "./forms";
import { isSafeDashboardExpression, type DashboardAction } from "@bernouy/cms-dashboards";
import { IntegrationInputError } from "../../../errors";
import { isRecord, text } from "../../definition/values";
import { requiredText } from "../common";
import { parseEndpointRef } from "./refs";
import { parseVisibilityRule } from "./visibility";

export function parseActions(value: unknown, name: string): DashboardAction[] {
    if (!Array.isArray(value)) {
        throw new IntegrationInputError(name, "must be an array");
    }
    return value.map((entry, index) => parseAction(entry, `${name}.${index}`));
}

function parseAction(value: unknown, name: string): DashboardAction {
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be an object");
    }
    if (value.endpoint !== undefined && !isRecord(value.endpoint)) {
        throw new IntegrationInputError(`${name}.endpoint`, "must be an object");
    }
    if (value.management !== undefined) {
        throw new IntegrationInputError(`${name}.management`, "is obsolete: use a native form management target");
    }
    if (value.endpoint !== undefined && !value.download) {
        throw new IntegrationInputError(`${name}.endpoint`, "is only supported for downloads: use form for mutations");
    }
    if (value.after !== undefined && !isRecord(value.after)) {
        throw new IntegrationInputError(`${name}.after`, "must be an object");
    }
    return {
        id: requiredText(value.id, `${name}.id`),
        label: requiredText(value.label, `${name}.label`),
        ...(text(value.icon) ? { icon: text(value.icon)! } : {}),
        ...(parseActionTone(value.tone, `${name}.tone`) ? { tone: parseActionTone(value.tone, `${name}.tone`)! } : {}),
        ...(parseActionPlacement(value.placement, `${name}.placement`)
            ? { placement: parseActionPlacement(value.placement, `${name}.placement`)! }
            : {}),
        ...(text(value.section) ? { section: text(value.section)! } : {}),
        ...(value.form !== undefined ? { form: parseActionForm(value.form, `${name}.form`) } : {}),
        ...(value.endpoint !== undefined ? { endpoint: parseEndpointRef(value.endpoint, `${name}.endpoint`) } : {}),
        ...(value.download !== undefined ? { download: parseActionDownload(value.download, `${name}.download`) } : {}),
        ...(value.selection !== undefined
            ? { selection: parseActionSelection(value.selection, `${name}.selection`) }
            : {}),
        ...(isRecord(value.after) ? { after: parseActionAfter(value.after, `${name}.after`) } : {}),
        ...(text(value.confirm) ? { confirm: text(value.confirm)! } : {}),
        ...(value.visibleWhen !== undefined
            ? { visibleWhen: parseVisibilityRule(value.visibleWhen, `${name}.visibleWhen`) }
            : {}),
    };
}

export function parseSelection(value: Record<string, unknown>): { opens?: string } {
    return {
        ...(text(value.opens) ? { opens: text(value.opens)! } : {}),
    };
}

function parseActionAfter(value: Record<string, unknown>, name: string): NonNullable<DashboardAction["after"]> {
    if (Object.hasOwn(value, "resource")) {
        throw new IntegrationInputError(`${name}.resource`, "is obsolete: reload the common source");
    }
    return { opens: requiredText(value.opens, `${name}.opens`), ...(text(value.row) ? { row: text(value.row)! } : {}) };
}

function parseActionDownload(value: unknown, name: string): NonNullable<DashboardAction["download"]> {
    if (value === true) {
        return {};
    }
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be true or an object");
    }
    return {
        ...(text(value.filename) ? { filename: text(value.filename)! } : {}),
    };
}

function parseActionTone(value: unknown, name: string): DashboardAction["tone"] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === "primary" || value === "secondary" || value === "danger") {
        return value;
    }
    throw new IntegrationInputError(name, "must be primary, secondary, or danger");
}

function parseActionPlacement(value: unknown, name: string): DashboardAction["placement"] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === "primary" || value === "secondary" || value === "more") {
        return value;
    }
    throw new IntegrationInputError(name, "must be primary, secondary, or more");
}

function parseActionSelection(value: unknown, name: string): NonNullable<DashboardAction["selection"]> {
    if (!isRecord(value)) {
        throw new IntegrationInputError(name, "must be an object");
    }
    const selection: NonNullable<DashboardAction["selection"]> = { opens: requiredText(value.opens, `${name}.opens`) };
    if (value.row !== undefined) {
        const row = requiredText(value.row, `${name}.row`);
        if (row.startsWith("$") && !isSafeDashboardExpression(row, ["resource", "selection"], true)) {
            throw new IntegrationInputError(`${name}.row`, "must be an identity or a safe resource or selection path");
        }
        selection.row = row;
    }
    return selection;
}
