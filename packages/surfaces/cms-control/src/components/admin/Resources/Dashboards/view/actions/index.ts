import { showToast } from "@bernouy/components";
import { detailKey } from "../../domain";
import { executeDashboardAction, executeDashboardTableAction } from "../../runtime/actions";
import type { WidgetActionDetail } from "../../widgets/shared";
import type { DashboardViewActionContext } from "./context";
import { once } from "./outcome";

export type { DashboardViewActionContext } from "./context";
export { runDashboardMediaAction } from "./media";

export async function runDashboardWidgetAction(
    context: DashboardViewActionContext,
    action: WidgetActionDetail,
): Promise<void> {
    const { group, dashboard, detail } = context;
    if (!group || !dashboard) {
        return;
    }
    const actionDetail = action.detail
        ? action.widget
            ? { collection: action.widget, row: action.row ?? detail?.row ?? "" }
            : detail
        : action.widget
          ? null
          : detail;
    const key = actionDetail ? detailKey(actionDetail.collection, actionDetail.row) : "";
    const finishAction = once(context.actionCoordinator?.beginAction());
    try {
        const submittedFields = structuredClone({ ...(context.drafts.get(key) ?? {}), ...(action.fields ?? {}) });
        const result = actionDetail
            ? await executeDashboardAction(
                  group,
                  dashboard,
                  actionDetail,
                  action.action,
                  submittedFields,
                  action.resource,
                  context.groups ?? [group],
              )
            : await executeDashboardTableAction(
                  group,
                  dashboard,
                  action.action,
                  action.widget,
                  action.value,
                  context.groups ?? [group],
                  context.filters?.get(action.widget ?? "") ?? {},
                  detail ?? undefined,
              );
        if (result.kind === "navigation") {
            if (finishAction() !== "stale") {
                (context.navigateDetail ?? context.openDetail)(result.collection, result.row);
            }
            return;
        }
        if (finishAction() !== "stale") {
            downloadBlob(result.blob, result.filename);
            showToast(`${action.action} downloaded`, { type: "success" });
        }
    } catch (error) {
        finishAction();
        showToast(error instanceof Error ? error.message : "Dashboard action failed", { type: "error" });
    }
}

function downloadBlob(blob: Blob, filename: string): void {
    if (typeof URL.createObjectURL !== "function") {
        throw new Error("Downloads are not supported in this browser");
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    if (typeof URL.revokeObjectURL === "function") {
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }
}
