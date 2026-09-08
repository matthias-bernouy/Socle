import { formatDashboardDate, formatDashboardMoney } from "../../../domain/formatting";
import { readonlyValue, textValue, tokenValue } from "../../../runtime/mapping/fieldSupport";
import { matchesDashboardVisibility } from "../../../runtime/expressions";
import type { DashboardVisibilityRule } from "@bernouy/cms-dashboards";

/** Pure value formatting/predicates; these filters never receive or construct DOM. */
export const dashboardDisplayFilters = {
    dashboardVisibility: (value: unknown, rule: unknown) =>
        Boolean(value && typeof value === "object") &&
        matchesDashboardVisibility(
            rule as DashboardVisibilityRule | undefined,
            value as { fields: Record<string, unknown>; resource: unknown },
        ),
    dashboardTokens: (value: unknown) => tokenValue(value).join(","),
    dashboardDefined: (value: unknown) => value !== null && value !== undefined,
    dashboardHttpUrl: (value: unknown) => {
        const text = textValue(value).trim();
        if (!text) {
            return "";
        }
        try {
            const url = new URL(text, window.location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch {
            return "";
        }
    },
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
