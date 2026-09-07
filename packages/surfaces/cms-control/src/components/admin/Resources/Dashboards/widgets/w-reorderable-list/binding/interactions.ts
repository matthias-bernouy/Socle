import { setValueAt, valueAt } from "../../../runtime/expressions";
import { W_MEDIA_FIELD_ACTION_EVENT, type DashboardMediaActionDetail } from "../../w-media-field/types";
import type { ReorderableField } from "./Field";

/** Only local operations and drag feedback; no response renderer or private source. */
export class ReorderableInteractions {
    pending?: Record<string, unknown>[];
    private dragging: number | undefined;
    constructor(private readonly host: ReorderableField) {}
    connect(): void {
        for (const [name, handler] of this.handlers) {
            this.host.addEventListener(name, handler);
        }
    }
    disconnect(): void {
        for (const [name, handler] of this.handlers) {
            this.host.removeEventListener(name, handler);
        }
        this.clearDrag();
    }
    private get handlers(): Array<[string, EventListener]> {
        return [
            ["click", this.click],
            ["dragstart", this.start],
            ["dragover", this.over],
            ["drop", this.drop],
            ["dragend", this.end],
            ["combobox-search", this.lookup],
            ["combobox-load-more", this.lookup],
            [W_MEDIA_FIELD_ACTION_EVENT, this.media],
        ];
    }
    private readonly click = (event: Event): void => {
        const target = event.target as Element | null;
        const add = target?.closest("[data-add]");
        const remove = target?.closest<HTMLElement>("[data-remove]");
        if (!add && !remove) {
            return;
        }
        const items = this.host.items;
        const max = this.host.getAttribute("max-items");
        const min = this.host.getAttribute("min-items");
        if (add && (max === null || items.length < Number(max))) {
            this.commit([...items, {}]);
        }
        if (remove && (min === null || items.length > Number(min))) {
            const index = Number(remove.dataset.remove);
            if (Number.isInteger(index) && index >= 0 && index < items.length) {
                items.splice(index, 1);
                this.commit(items);
            }
        }
    };
    private readonly start = (event: Event): void => {
        const handle = (event.target as Element | null)?.closest(".handle");
        const row = handle?.closest<HTMLElement>("cms-dashboard-reorderable-row");
        if (!row) {
            return;
        }
        this.dragging = Number(row.dataset.index);
        row.dataset.dragging = "";
        const transfer = (event as DragEvent).dataTransfer;
        transfer?.setData("text/plain", String(this.dragging));
        if (transfer) {
            transfer.effectAllowed = "move";
        }
    };
    private readonly over = (event: Event): void => {
        const row = (event.target as Element | null)?.closest<HTMLElement>("cms-dashboard-reorderable-row");
        if (!row || this.dragging === undefined) {
            return;
        }
        event.preventDefault();
        for (const item of this.rows) {
            item.toggleAttribute("data-drop-target", item === row);
        }
        const transfer = (event as DragEvent).dataTransfer;
        if (transfer) {
            transfer.dropEffect = "move";
        }
    };
    private readonly drop = (event: Event): void => {
        const row = (event.target as Element | null)?.closest<HTMLElement>("cms-dashboard-reorderable-row");
        if (!row || this.dragging === undefined) {
            return;
        }
        event.preventDefault();
        const to = Number(row.dataset.index);
        const items = this.host.items;
        if (to !== this.dragging && to >= 0 && to < items.length) {
            const [item] = items.splice(this.dragging, 1);
            if (item) {
                items.splice(to, 0, item);
                this.commit(items);
            }
        }
        this.clearDrag();
    };
    private readonly end = (): void => this.clearDrag();
    private readonly lookup = (event: Event): void => {
        const editor = (event.target as Element | null)?.closest<HTMLElement>("[data-item-field]");
        const source = Array.from(this.host.querySelectorAll<HTMLElement>("cms-dashboard-lookup[item-field]")).find(
            (node) => node.getAttribute("item-field") === editor?.dataset.itemField,
        );
        if (source) {
            event.stopPropagation();
            source.dispatchEvent(new CustomEvent(event.type, { detail: (event as CustomEvent).detail }));
        }
    };
    private readonly media = (event: Event): void => {
        if (event.target === this.host) {
            return;
        }
        const editor = (event.target as Element | null)?.closest<HTMLElement>("[data-item-field]");
        if (!editor?.dataset.itemPath) {
            return;
        }
        event.stopPropagation();
        const detail = (event as CustomEvent<DashboardMediaActionDetail>).detail;
        const items = this.host.items;
        const index = Number(editor.dataset.itemIndex);
        const parent = items[index];
        if (!parent) {
            return;
        }
        setValueAt(parent, editor.dataset.itemPath, detail.value[0] ?? null);
        const scoped = {
            ...detail,
            itemIndex: index,
            itemKey: String(valueAt(parent, this.host.getAttribute("item-key") ?? "") ?? index),
            itemKeyPath: this.host.getAttribute("item-key") ?? "",
            itemField: editor.dataset.itemField,
            itemPath: editor.dataset.itemPath,
            parentItem: structuredClone(parent),
        };
        this.commit(items);
        this.host.dispatchEvent(
            new CustomEvent(W_MEDIA_FIELD_ACTION_EVENT, { bubbles: true, composed: true, detail: scoped }),
        );
    };
    private commit(items: Record<string, unknown>[]): void {
        for (const [index, item] of items.entries()) {
            setValueAt(item, this.host.getAttribute("position-path") ?? "position", index);
        }
        this.pending = items;
        try {
            this.host.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        } finally {
            this.pending = undefined;
        }
    }
    private get rows(): HTMLElement[] {
        return Array.from(this.host.querySelectorAll("cms-dashboard-reorderable-row"));
    }
    private clearDrag(): void {
        this.dragging = undefined;
        for (const row of this.rows) {
            row.removeAttribute("data-dragging");
            row.removeAttribute("data-drop-target");
        }
    }
}
