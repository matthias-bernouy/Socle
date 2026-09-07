import type { DashboardField } from "@bernouy/cms-dashboards";
import { setValueAt, valueAt } from "../../../runtime/expressions";
import { tableRows } from "../../w-detail/controls/table/context";
import { choiceMedia, type ChoiceMedia } from "./media";

export type ReorderableDefinition = Extract<DashboardField, { type: "reorderable-list" }>;
type Choice = {
    index: number;
    identity: string;
    title: string;
    source: Record<string, unknown>;
    cells: Record<string, string | boolean>;
    media: Record<string, ChoiceMedia>;
};
type State = { definition: ReorderableDefinition; rows: Choice[] };
const owners = new WeakMap<Element, Map<string, State>>();

/** Positional projections feed ordinary repeats; controls never receive response objects. */
export function reorderableContext(owner: HTMLElement, fields: DashboardField[]) {
    const state = new Map<string, State>();
    owners.set(owner, state);
    for (const definition of fields.filter((field) => field.type === "reorderable-list")) {
        state.set(definition.id, { definition, rows: [] });
    }
    return (values: Record<string, unknown>, edits: Record<string, unknown>) => {
        const urls = new Set<string>();
        const result = Object.fromEntries(
            Array.from(state, ([id, entry]) => {
                entry.rows = tableRows(values[id]).map((source, index) => {
                    const identity = valueAt(source, entry.definition.itemKey);
                    const row = entry.rows[index] ?? { index, identity: "", title: "", source, cells: {}, media: {} };
                    row.source = source;
                    row.identity = String(identity ?? index);
                    row.title = String(identity ?? `Item ${index + 1}`);
                    for (const field of entry.definition.fields) {
                        const value = valueAt(source, field.path);
                        if (field.type === "media") {
                            row.media[field.id] = choiceMedia(
                                owner,
                                id,
                                index,
                                field,
                                value,
                                Object.hasOwn(edits, id),
                                row.media[field.id],
                            );
                            for (const item of row.media[field.id]!.items) {
                                urls.add(item.url);
                            }
                        } else {
                            row.cells[field.id] =
                                field.type === "checkbox"
                                    ? value === true || value === "true" || value === 1
                                    : value == null
                                      ? ""
                                      : String(value);
                        }
                    }
                    return row;
                });
                return [
                    id,
                    {
                        rows: entry.rows,
                        addDisabled:
                            entry.definition.maxItems !== undefined && entry.rows.length >= entry.definition.maxItems,
                        removeDisabled:
                            entry.definition.minItems !== undefined && entry.rows.length <= entry.definition.minItems,
                    },
                ];
            }),
        );
        return { result, urls };
    };
}

/** Snapshot user operation input, preserving unedited optional and opaque fields. */
export function readReorderableItems(control: HTMLElement): Record<string, unknown>[] {
    const owner = control.closest("cms-dashboard-w-detail");
    const entry = owner ? owners.get(owner)?.get(control.dataset.fieldControl ?? "") : undefined;
    if (!entry) {
        return [];
    }
    return Array.from(control.querySelectorAll<HTMLElement>("cms-dashboard-reorderable-row[data-index]")).map(
        (element) => {
            const index = Number(element.dataset.index);
            const row = entry.rows[index];
            const item = structuredClone(row?.source ?? {});
            for (const field of entry.definition.fields) {
                const editor = Array.from(element.querySelectorAll<HTMLElement>("[data-item-field]")).find(
                    (node) => node.dataset.itemField === field.id,
                );
                if (!editor) {
                    continue;
                }
                const value =
                    field.type === "media"
                        ? ((editor as HTMLElement & { items: unknown[] }).items[0] ?? null)
                        : field.type === "checkbox"
                          ? (editor as HTMLInputElement).checked
                          : "value" in editor
                            ? String(editor.value ?? "")
                            : "";
                if (field.type === "media" || value !== row?.cells[field.id]) {
                    setValueAt(item, field.path, value);
                }
            }
            setValueAt(item, entry.definition.positionPath ?? "position", index);
            return item;
        },
    );
}
