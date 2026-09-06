import { formatDashboardDate, formatDashboardMoney } from "../../../domain/formatting";
import { readonlyValue, textValue, tokenValue } from "../../../runtime/mapping/fieldSupport";

/** Pure value formatting/predicates; these filters never receive or construct DOM. */
export const dashboardDisplayFilters = {
    dashboardTokens: (value: unknown) => tokenValue(value).join(","),
    dashboardDefined: (value: unknown) => value !== null && value !== undefined,
    dashboardTrimmedText: (value: unknown) => textValue(value).trim(),
    dashboardValueKind: (value: unknown) => {
        const display = readonlyValue(value);
        return Array.isArray(display) ? (display.length ? "list" : "empty-list") : "scalar";
    },
    dashboardBadge: (value: unknown) => String(readonlyValue(value)),
    dashboardDate: (value: unknown) => formatDashboardDate(value),
    dashboardMoney: (value: unknown, currency: unknown) =>
        formatDashboardMoney(value, textValue(currency).trim() || undefined),
};
