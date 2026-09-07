import { showToast } from "@bernouy/components";
import { detailKey } from "../../domain";
import { settleNestedMedia } from "./nestedMedia";
import { executeDashboardMediaAction } from "../../runtime/actions";
import type { WidgetMediaActionDetail } from "../../widgets/shared";
import type { DashboardViewActionContext } from "./context";
import { once } from "./outcome";
import { remainingDraft } from "../../domain/drafts";

export async function runDashboardMediaAction(
    context: DashboardViewActionContext,
    media: WidgetMediaActionDetail,
    widget?: HTMLElement,
): Promise<void> {
    const { group, dashboard } = context;
    const detail = media.widget ? { collection: media.widget, row: media.rowKey } : context.detail;
    if (!group || !dashboard || !detail) {
        return;
    }
    const key = detailKey(detail.collection, detail.row);
    const finishAction = once(context.actionCoordinator?.beginAction());
    try {
        const result = await executeDashboardMediaAction(
            group,
            dashboard,
            detail,
            media,
            context.drafts.get(key) ?? {},
            context.groups ?? [group],
            context.submit,
        );
        if (finishAction() === "stale") {
            return;
        }
        if (result.nested) {
            if (result.handled && (media.action === "upload" || media.action === "replace") && !result.item) {
                throw new Error("The media endpoint returned no usable media item");
            }
            settleNestedMedia(context, key, media, widget, result.item);
            showToast(`Media ${media.action} completed`, { type: "success" });
            return;
        }
        removeDraftField(context.drafts, key, media.field);
        context.acknowledgeDetailFields?.(detail.collection, detail.row, { [media.field]: media.value });
        showToast(`Media ${media.action} completed`, { type: "success" });
        context.reload(detail.collection, detail.row);
    } catch (error) {
        if (finishAction() === "stale") {
            return;
        }
        if (media.itemField) {
            settleNestedMedia(context, key, media, widget, undefined, true);
        } else if (media.previousValue !== undefined) {
            const draft = context.drafts.get(key);
            if (
                draft &&
                Object.hasOwn(draft, media.field) &&
                !Object.hasOwn(remainingDraft(draft, { [media.field]: media.value }), media.field)
            ) {
                context.drafts.set(key, { ...draft, [media.field]: structuredClone(media.previousValue) });
            }
            context.restoreDetailField?.(detail.collection, detail.row, media.field, media.value, media.previousValue);
        }
        showToast(error instanceof Error ? error.message : "Dashboard media action failed", { type: "error" });
    }
}

function removeDraftField(drafts: Map<string, Record<string, unknown>>, key: string, field: string): void {
    const draft = { ...(drafts.get(key) ?? {}) };
    delete draft[field];
    Object.keys(draft).length ? drafts.set(key, draft) : drafts.delete(key);
}
