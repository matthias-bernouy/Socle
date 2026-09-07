import { setValueAt, valueAt } from "../../runtime/expressions";
import type { WidgetMediaActionDetail } from "../../widgets/shared";
import type { DashboardMediaItem } from "../../widgets/w-media-field/types";
import type { DashboardViewActionContext } from "./context";

type BoundDetail = HTMLElement & {
    currentFieldValues(): Record<string, unknown>;
    applyFieldDraft(field: string, value: unknown): void;
};

/** Settle one local media edit against the latest draft, including unblurred typing. */
export function settleNestedMedia(
    context: DashboardViewActionContext,
    key: string,
    media: WidgetMediaActionDetail,
    widget: HTMLElement | undefined,
    item?: DashboardMediaItem,
    failed = false,
): void {
    const bound = widget?.hasAttribute("data-declarative") ? (widget as BoundDetail) : undefined;
    const draft = { ...(context.drafts.get(key) ?? {}) };
    const items = cloneItems(bound?.currentFieldValues()[media.field] ?? draft[media.field]);
    const parent = nestedMediaParent(items, media);
    const current = parent && media.itemPath ? valueAt(parent, media.itemPath) : undefined;
    const expected = media.value[0] ?? null;
    // A later edit or removed choice must never be overwritten by an older response.
    if (parent && media.itemPath && sameMedia(current, expected)) {
        if (failed) {
            const previous =
                media.action === "replace" ? media.previousItem : media.action === "remove" ? media.item : null;
            setValueAt(parent, media.itemPath, previous ?? null);
        } else if (media.action === "upload" || media.action === "replace") {
            const alt = current && typeof current === "object" && "alt" in current ? current.alt : undefined;
            setValueAt(parent, media.itemPath, item ? { ...item, ...(typeof alt === "string" ? { alt } : {}) } : null);
        }
    }
    draft[media.field] = items;
    context.drafts.set(key, draft);
    if (bound) {
        bound.applyFieldDraft(media.field, items);
        return;
    }
    const control = Array.from(widget?.shadowRoot?.querySelectorAll<HTMLElement>("[data-field-control]") ?? []).find(
        (node) => node.dataset.fieldControl === media.field,
    ) as (HTMLElement & { data?: { items?: Record<string, unknown>[] } }) | undefined;
    if (control?.data) {
        control.data = { ...control.data, items: structuredClone(items) };
    } else {
        context.render();
    }
}

function cloneItems(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value)
        ? structuredClone(
              value.filter(
                  (item): item is Record<string, unknown> =>
                      item !== null && typeof item === "object" && !Array.isArray(item),
              ),
          )
        : [];
}

function nestedMediaParent(
    items: Record<string, unknown>[],
    media: WidgetMediaActionDetail,
): Record<string, unknown> | undefined {
    if (media.itemKeyPath && valueAt(media.parentItem, media.itemKeyPath) != null) {
        return items.find((item) => String(valueAt(item, media.itemKeyPath!)) === media.itemKey);
    }
    const pending = media.value[0];
    if (pending && media.itemPath) {
        const parent = items.find((item) => sameMedia(valueAt(item, media.itemPath!), pending));
        if (parent) {
            return parent;
        }
    }
    return items[media.itemIndex ?? -1];
}

function sameMedia(left: unknown, right: DashboardMediaItem | null): boolean {
    if (left == null || right === null) {
        return left == null && right === null;
    }
    return typeof left === "object" && "id" in left && "url" in left && left.id === right.id && left.url === right.url;
}
