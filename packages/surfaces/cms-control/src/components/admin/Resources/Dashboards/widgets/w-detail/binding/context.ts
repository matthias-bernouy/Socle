import { directoryContext } from "../lookups/directoryContext";
import { detailLookupUrls } from "../lookups/urls";
import { readSourceData, setSourceContext } from "@bernouy/components";
import { fieldValues } from "../../../runtime/mapping";
import { matchesDashboardVisibility, setValueAt, valueAt } from "../../../runtime/expressions";
import { currencyFractionDigits, formatMinorUnits } from "../../../runtime/mapping/money";
import { actionLayout } from "./actions";
import type { DetailWidget } from "../runtime/fieldState";

/** Project response values and local edits into binding scope; never constructs DOM. */
export function bindDetailContext(
    host: HTMLElement,
    widget: DetailWidget,
    draft: (resource: unknown) => Record<string, unknown>,
    displayDraft: () => Record<string, string>,
): void {
    const fields = [...widget.main, ...(widget.aside ?? [])].flatMap((section) =>
        "widget" in section ? [] : section.fields,
    );
    const users = directoryContext(host, fields);
    const actions = actionLayout(widget.actions ?? []);
    const rules = Object.fromEntries(fields.map((field) => [field.id, field.visibleWhen]));
    setSourceContext(host, () => {
        const source = readSourceData(host);
        const resource = widget.source.itemPath ? valueAt(source, widget.source.itemPath) : source;
        const edits = draft(resource);
        const values = { ...fieldValues(widget, resource), ...edits };
        let effective = structuredClone(resource);
        for (const field of fields) {
            if (!Object.hasOwn(edits, field.id)) {
                continue;
            }
            if (field.path === ".") {
                effective = edits[field.id];
            } else if (effective && typeof effective === "object" && !Array.isArray(effective)) {
                setValueAt(effective as Record<string, unknown>, field.path, edits[field.id]);
            }
        }
        const amounts = Object.fromEntries(
            fields
                .filter((field) => field.type === "money")
                .map((field) => {
                    const currency = field.currencyPath
                        ? (valueAt(values, field.currencyPath) ?? valueAt(resource, field.currencyPath))
                        : undefined;
                    const decimals =
                        typeof field.allowDecimals === "object"
                            ? matchesDashboardVisibility(field.allowDecimals, { fields: values, resource })
                            : field.allowDecimals !== false;
                    return [
                        field.id,
                        {
                            value:
                                displayDraft()[field.id] ??
                                formatMinorUnits(
                                    values[field.id],
                                    currencyFractionDigits(typeof currency === "string" ? currency : undefined),
                                    decimals,
                                ),
                            inputmode: decimals ? "decimal" : "numeric",
                        },
                    ];
                }),
        );
        return {
            ...users(values, resource),
            detailResourcePath: widget.source.itemPath ?? "",
            detailLookupUrls: detailLookupUrls(fields, host.dataset.sourceId ?? "", values, resource),
            detailReady: resource !== null && resource !== undefined,
            detailValues: effective,
            detailActions: actions(values, resource),
            detailAmounts: amounts,
            detailVisibility: { fields: values, resource },
            detailRules: rules,
        };
    });
}
