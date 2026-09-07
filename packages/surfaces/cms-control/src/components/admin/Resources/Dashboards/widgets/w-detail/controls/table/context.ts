import type { DashboardLookup } from "../../lookups/Lookup";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { formatDashboardValue } from "../../../../domain/formatting";
import { valueAt, setValueAt } from "../../../../runtime/expressions";
import { readTableEditor } from "../editors";
import type { WDetailField } from "../../types";

type Row = { index: number; source: Record<string, unknown>; cells: Record<string, string> };
const tables = new WeakMap<Element, Map<string, Row[]>>();

/** Stable positional projections keep active cells in ordinary binding repeats. */
export function tableContext(host: HTMLElement, fields: DashboardField[]) {
    const definitions = fields.filter((field) => field.type === "table");
    const state = new Map<string, Row[]>();
    tables.set(host, state);
    return (values: Record<string, unknown>) =>
        Object.fromEntries(
            definitions.map((field) => {
                const previous = state.get(field.id) ?? [];
                const rows = tableRows(values[field.id]).map((source, index) => {
                    const row = previous[index] ?? { index, source, cells: {} };
                    row.source = source;
                    for (const column of field.columns) {
                        const value = valueAt(source, column.path);
                        const editor = field.editable && column.editable;
                        row.cells[column.id] = editor
                            ? column.type === "tokens"
                                ? Array.isArray(value)
                                    ? value.join(",")
                                    : ""
                                : value == null
                                  ? ""
                                  : String(value)
                            : formatDashboardValue(value, column.format, { currency: currency(source, column.path) });
                    }
                    return row;
                });
                state.set(field.id, rows);
                return [field.id, rows];
            }),
        );
}

/** Read operation input, preserving opaque fields from the binding's row data. */
export function readBoundTableRows(field: WDetailField, control: HTMLElement): Record<string, unknown>[] {
    if (!field.editable) {
        return structuredClone(tableRows(field.value));
    }
    const host = control.closest("cms-dashboard-w-detail");
    const sources = host ? tables.get(host)?.get(field.id) : undefined;
    return Array.from(control.querySelectorAll<HTMLElement>("[data-table-row]")).map((element) => {
        const row = structuredClone(sources?.[Number(element.dataset.tableIndex)]?.source ?? {});
        for (const column of field.columns ?? []) {
            const editor = Array.from(element.querySelectorAll<HTMLElement>("[data-table-column]")).find(
                (node) => node.dataset.tableColumn === column.key,
            );
            if (editor) {
                setValueAt(row, column.path, readTableEditor(column, editor));
            }
        }
        return row;
    });
}

export function tableRows(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? value.filter(
              (row): row is Record<string, unknown> => row !== null && typeof row === "object" && !Array.isArray(row),
          )
        : [];
}

export function serializedTableRows(value: unknown): Record<string, unknown>[] {
    return tableRows(value).filter(hasValue);
}

function hasValue(value: unknown): boolean {
    if (value && typeof value === "object") {
        return Object.values(value).some(hasValue);
    }
    return String(value ?? "").trim().length > 0;
}

function currency(row: Record<string, unknown>, path: string): string | undefined {
    const separator = path.lastIndexOf(".");
    const sibling = separator < 0 ? "currency" : `${path.slice(0, separator)}.currency`;
    const value = valueAt(row, sibling) ?? row.currency;
    return value == null ? undefined : String(value).trim() || undefined;
}

export function tableLookupContexts(host: HTMLElement): Record<string, unknown> {
    return Object.fromEntries(
        Array.from(host.querySelectorAll<DashboardLookup>("cms-dashboard-lookup[context-name]")).map((source) => [
            source.getAttribute("context-name")!,
            source.sharedContext,
        ]),
    );
}
