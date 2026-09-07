import type { DashboardReorderableListItemField } from "@bernouy/cms-dashboards";
import type { DashboardMediaField } from "../../w-media-field/binding/MediaField";
import type { DashboardMediaItem } from "../../w-media-field/types";
import { mediaValue } from "../../../runtime/media";

type Item = DashboardMediaItem & { index: number; thumbnail: string; title: string; previewAlt: string };
export type ChoiceMedia = {
    items: Item[];
    showAdd: boolean;
    index: number;
    open: boolean;
    preview?: Item;
    counter: string;
};

/** Project a nested singleton into the existing media binding declarations. */
export function choiceMedia(
    owner: HTMLElement,
    fieldId: string,
    index: number,
    field: Extract<DashboardReorderableListItemField, { type: "media" }>,
    raw: unknown,
    draft: boolean,
    previous?: ChoiceMedia,
): ChoiceMedia {
    const source =
        draft && raw && typeof raw === "object" && "id" in raw && "url" in raw
            ? [raw as DashboardMediaItem]
            : mediaValue(raw, field, owner.dataset.sourceId ?? "");
    const items = source.map((item, itemIndex) => {
        const projected = {
            ...item,
            index: itemIndex,
            thumbnail: item.thumbnailUrl || item.url,
            title: item.name?.trim() || item.alt?.trim() || `Image ${itemIndex + 1}`,
            previewAlt: item.alt?.trim() || item.name?.trim() || `Image ${itemIndex + 1}`,
        };
        const old = previous?.items[itemIndex];
        return old && JSON.stringify(old) === JSON.stringify(projected) ? old : projected;
    });
    const control = Array.from(
        owner.querySelectorAll<DashboardMediaField>("cms-dashboard-media-field[data-item-field]"),
    ).find(
        (node) =>
            node.closest<HTMLElement>("[data-field-control]")?.dataset.fieldControl === fieldId &&
            node.dataset.itemIndex === String(index) &&
            node.dataset.itemField === field.id,
    );
    const open = (control?.preview.opened ?? false) && items.length > 0;
    return { items, showAdd: items.length === 0, index: 0, open, preview: items[0], counter: `1 / ${items.length}` };
}
