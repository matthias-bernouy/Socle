export { currencyFractionDigits, formatMinorUnits, parseMajorUnits } from "@bernouy/components";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { matchesDashboardVisibility, valueAt } from "../expressions";

/** Resolve declarative currency rules; the control owns formatting and conversion. */
export function moneyFieldContext(fields: DashboardField[], resource: unknown, values: Record<string, unknown>) {
    return Object.fromEntries(
        fields
            .filter((field) => field.type === "money")
            .map((field) => [
                field.id,
                {
                    currency: field.currencyPath
                        ? (valueAt(values, field.currencyPath) ?? valueAt(resource, field.currencyPath))
                        : "",
                    allowDecimals:
                        typeof field.allowDecimals === "object"
                            ? matchesDashboardVisibility(field.allowDecimals, { fields: values, resource })
                            : field.allowDecimals !== false,
                },
            ]),
    );
}
