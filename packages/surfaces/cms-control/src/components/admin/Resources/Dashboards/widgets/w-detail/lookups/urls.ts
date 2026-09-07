import type { DashboardField } from "@bernouy/cms-dashboards";
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
            const vars = {
                fields: values,
                resource,
                ...(lookupUsesRemoteSearch(field.lookup) ? { search: "" } : {}),
                ...(lookupUsesOffsetPagination(field.lookup) ? { limit: 25, offset: 0 } : {}),
            };
            const ready = Object.values(field.lookup.params ?? {}).every((expression) => {
                if (!expression.startsWith("$") || ["$search", "$limit", "$offset"].includes(expression)) {
                    return true;
                }
                const value = resolveExpression(expression, vars);
                return value !== undefined && value !== null && value !== "";
            });
            return [[field.id, ready ? sourceUrl(sourceId, field.lookup, vars).href : ""]];
        }),
    );
}
