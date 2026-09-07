import type { DashboardSaveOperation } from "@bernouy/cms-dashboards";
import { valueAt } from "../../../expressions";
import { hasMissingTechnicalFields } from "./technicalFields";
import { observeSource, refreshSourceContext, showToast } from "@bernouy/components";
import { CMS_SOURCE_SUCCESS_EVENT, CMS_SOURCE_REFRESH_FAILED_EVENT } from "@bernouy/components/binding";

export const DETAIL_SAVED_EVENT = "cms-dashboard-detail:saved";
export type DetailSaved = { created: boolean; body?: unknown; id?: string };

/** Coordinates draft acknowledgement; transport and locking belong to the form binding. */
export function connectDetailForm(
    host: HTMLElement,
    validate: () => boolean,
    capture: () => Record<string, unknown>,
    acknowledge: (snapshot: Record<string, unknown>) => void,
    creation?: DashboardSaveOperation,
): () => void {
    let awaitingRead = false;
    let submitted: Record<string, unknown> = {};
    let submittedScope = "";
    const scope = () => `${host.dataset.sourceId ?? ""}\u0000${host.dataset.rowKey ?? ""}`;
    const saved = (detail: DetailSaved = { created: false }) => {
        acknowledge(submitted);
        refreshSourceContext(host);
        showToast("Changes saved", { type: "success" });
        host.dispatchEvent(new CustomEvent(DETAIL_SAVED_EVENT, { bubbles: true, composed: true, detail }));
    };
    const success = (event: Event) => {
        if (
            host.isConnected &&
            scope() === submittedScope &&
            (event.target as Element).matches("[data-detail-save]") &&
            (event.target as Element).closest("cms-dashboard-w-detail") === host
        ) {
            awaitingRead = false;
            if (creation) {
                const body = (event as CustomEvent<{ body: unknown }>).detail.body;
                const id = valueAt(body, creation.idPath ?? "id");
                if ((typeof id !== "string" && typeof id !== "number") || !String(id)) {
                    host.setAttribute("data-create-result-invalid", "");
                    showToast(
                        "The resource was created, but the response did not identify it. Open the list to find it before trying again.",
                        { type: "error" },
                    );
                    return;
                }
                saved({ created: true, body, id: String(id) });
            } else {
                saved();
            }
        }
    };
    const partial = (event: Event) => {
        if (
            host.isConnected &&
            scope() === submittedScope &&
            (event.target as Element).matches("[data-detail-save]") &&
            (event.target as Element).closest("cms-dashboard-w-detail") === host
        ) {
            awaitingRead = true;
            showToast("Changes were saved, but the detail could not be reloaded. Retry the read before saving again.", {
                type: "warning",
            });
        }
    };
    const submit = (event: Event) => {
        if ((event.target as Element).closest("cms-dashboard-w-detail") !== host) {
            return;
        }
        if (host.hasAttribute("data-create-result-invalid")) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        if (awaitingRead) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showToast("Retry the detail read before running another operation.", { type: "warning" });
            return;
        }
        if (!(event.target as Element).matches("[data-detail-save]")) {
            return;
        }
        const missing = hasMissingTechnicalFields(event.target as HTMLFormElement);
        if (missing || !validate()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (missing) {
                showToast("The detail identity or revision is missing. Reload the detail.", { type: "error" });
            }
            return;
        }
        submittedScope = scope();
        submitted = structuredClone(capture());
    };
    const stop = observeSource(host, (state) => {
        if (state.disposed || scope() !== submittedScope) {
            awaitingRead = false;
            return;
        }
        if (
            awaitingRead &&
            !state.loading &&
            !state.refreshing &&
            !state.error &&
            !state.refreshError &&
            !state.disposed
        ) {
            awaitingRead = false;
            saved();
        }
    });
    host.addEventListener("submit", submit, true);
    host.addEventListener(CMS_SOURCE_SUCCESS_EVENT, success);
    host.addEventListener(CMS_SOURCE_REFRESH_FAILED_EVENT, partial);
    return () => {
        stop();
        host.removeEventListener("submit", submit, true);
        host.removeEventListener(CMS_SOURCE_SUCCESS_EVENT, success);
        host.removeEventListener(CMS_SOURCE_REFRESH_FAILED_EVENT, partial);
    };
}
