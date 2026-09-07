import type { DashboardEmbeddedLookupRef, DashboardField } from "@bernouy/cms-dashboards";
import { sourceUrl } from "../../../runtime/source";
import { lookupUsesOffsetPagination, lookupUsesRemoteSearch } from "../../../runtime/lookups";
import { resolveExpression } from "../../../runtime/expressions";

export function detailLookupUrls(
    fields: DashboardField[],
    sourceId: string,
    values: Record<string, unknown>,
    resource: unknown,
) {
    return Object.fromEntries(
        fields.flatMap((field) => {
            if ((field.type !== "combobox" && field.type !== "tokens") || !field.lookup) {
                return [];
            }
            return [[field.id, lookupUrl(field.lookup, sourceId, values, resource)]];
        }),
    );
}

function lookupUrl(
    lookup: DashboardEmbeddedLookupRef,
    sourceId: string,
    values: Record<string, unknown>,
    resource: unknown,
): string {
    const vars = {
        fields: values,
        resource,
        ...(lookupUsesRemoteSearch(lookup) ? { search: "" } : {}),
        ...(lookupUsesOffsetPagination(lookup) ? { limit: 25, offset: 0 } : {}),
    };
    const ready = Object.values(lookup.params ?? {}).every((expression) => {
        if (!expression.startsWith("$") || ["$search", "$limit", "$offset"].includes(expression)) {
            return true;
        }
        const value = resolveExpression(expression, vars);
        return value !== undefined && value !== null && value !== "";
    });
    return ready ? sourceUrl(sourceId, lookup, vars).href : "";
}

export function tableLookupUrls(
    fields: DashboardField[],
    sourceId: string,
    values: Record<string, unknown>,
    resource: unknown,
) {
    return Object.fromEntries(
        fields
            .filter((field) => field.type === "table")
            .map((field) => [
                field.id,
                Object.fromEntries(
                    field.columns.flatMap((column) =>
                        column.editable && column.type === "combobox" && column.lookup
                            ? [[column.id, lookupUrl(column.lookup, sourceId, values, resource)]]
                            : [],
                    ),
                ),
            ]),
    );
}
