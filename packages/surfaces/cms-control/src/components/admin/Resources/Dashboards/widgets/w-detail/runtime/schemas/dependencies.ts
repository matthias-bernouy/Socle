import type { DashboardField } from "@bernouy/cms-dashboards";
import { resolveExpression } from "../../../../runtime/expressions";

export function schemaDependenciesResolved(
    field: Extract<DashboardField, { type: "schema" }>,
    resource: unknown,
    fields: Record<string, unknown>,
): boolean {
    return Object.values(field.schema.params ?? {}).every((expression) => {
        if (!expression.startsWith("$")) {
            return true;
        }
        const value = resolveExpression(expression, { resource, fields });
        return value !== undefined && value !== null && value !== "";
    });
}
