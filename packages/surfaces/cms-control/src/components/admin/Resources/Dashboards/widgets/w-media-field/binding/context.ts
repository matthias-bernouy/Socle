import type { DashboardField } from "@bernouy/cms-dashboards";
import { mediaValue } from "../../../runtime/media";
import type { DashboardMediaItem } from "../types";
import type { DashboardMediaField } from "./MediaField";
import { mediaFiles } from "./files";

type MediaItem = DashboardMediaItem & { index: number; thumbnail: string; title: string; previewAlt: string };
export function mediaContext(owner: HTMLElement, fields: DashboardField[]) {
    const definitions = fields.filter((field) => field.type === "media");
    const cache = new Map<string, { raw: unknown; draft: boolean; items: MediaItem[] }>();
    return (values: Record<string, unknown>, edits: Record<string, unknown>) => {
        const urls = new Set<string>();
        const result = Object.fromEntries(
            definitions.map((field) => {
                const raw = values[field.id];
                const draft = Object.hasOwn(edits, field.id);
                let entry = cache.get(field.id);
                if (!entry || entry.raw !== raw || entry.draft !== draft) {
                    const items =
                        draft && Array.isArray(raw)
                            ? (raw as DashboardMediaItem[])
                            : mediaValue(raw, field, owner.dataset.sourceId ?? "");
                    entry = {
                        raw,
                        draft,
                        items: items.map((item, index) => ({
                            ...item,
                            index,
                            thumbnail: item.thumbnailUrl || item.url,
                            title: item.name?.trim() || item.alt?.trim() || `Image ${index + 1}`,
                            previewAlt: item.alt?.trim() || item.name?.trim() || `Image ${index + 1}`,
                        })),
                    };
                    cache.set(field.id, entry);
                }
                for (const item of entry.items) {
                    urls.add(item.url);
                }
                const control = Array.from(
                    owner.querySelectorAll<DashboardMediaField>("cms-dashboard-media-field"),
                ).find((node) => node.dataset.fieldControl === field.id);
                const index = Math.min(control?.preview.index ?? 0, Math.max(0, entry.items.length - 1));
                const open = (control?.preview.opened ?? false) && entry.items.length > 0;
                return [
                    field.id,
                    {
                        items: entry.items,
                        showAdd: field.multiple || entry.items.length === 0,
                        index,
                        open,
                        preview: entry.items[index],
                        counter: `${index + 1} / ${entry.items.length}`,
                    },
                ];
            }),
        );
        mediaFiles(owner).retain(urls);
        return result;
    };
}
