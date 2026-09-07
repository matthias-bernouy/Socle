import {
    isSafeDashboardExpression,
    type DashboardEmbeddedLookupRef,
    type DashboardOption,
} from "@bernouy/cms-dashboards";
import { readSourceData } from "@bernouy/components";
import { resolveExpression, textAt, valueAt } from "../../../runtime/expressions";
import { itemsFrom } from "../../../runtime/source";

/** Data projection only. The source's repeat owns every rendered option. */
export function lookupPage(host: HTMLElement, payload: unknown) {
    const lookup: DashboardEmbeddedLookupRef = {
        endpoint: "",
        valuePath: host.getAttribute("value-path") ?? "id",
        labelPath: host.getAttribute("label-path") ?? "name",
        itemsPath: host.getAttribute("items-path") || undefined,
    };
    const items = itemsFrom(payload, lookup);
    const options = items.flatMap((item) => option(item, lookup));
    const totalPath = host.getAttribute("total-path");
    const totalValue = totalPath ? valueAt(payload, totalPath) : undefined;
    const parsedTotal = Number(totalValue);
    const total = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : undefined;
    return { options, received: items.length, total };
}

export function selectedLookupOptions(host: HTMLElement): DashboardOption[] {
    const parent = host.closest("cms-dashboard-w-detail");
    const data = parent ? readSourceData(parent) : undefined;
    const resourcePath = host.getAttribute("resource-path");
    const resource = resourcePath ? valueAt(data, resourcePath) : data;
    const expression = host.getAttribute("selected-expression");
    if (!expression || !isSafeDashboardExpression(expression, ["resource"], true)) {
        return [];
    }
    const items = resolveExpression(expression, { resource });
    const selected = new Set((host.getAttribute("selected-value") ?? "").split(","));
    const lookup = {
        valuePath: host.getAttribute("value-path") ?? "id",
        labelPath: host.getAttribute("label-path") ?? "name",
    };
    return (Array.isArray(items) ? items : [items]).flatMap((item) =>
        option(item, lookup, false).filter((entry) => selected.has(entry.value)),
    );
}

export function distinctOptions(options: DashboardOption[]): DashboardOption[] {
    const seen = new Set<string>();
    return options.filter((option) => {
        if (seen.has(option.value)) {
            return false;
        }
        seen.add(option.value);
        return true;
    });
}

function option(item: unknown, lookup: { valuePath: string; labelPath: string }, fallback = true): DashboardOption[] {
    const value = textAt(item, lookup.valuePath);
    const label = textAt(item, lookup.labelPath, fallback ? value : "");
    return value && label ? [{ value, label }] : [];
}
