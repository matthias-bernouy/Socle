import { observeSource, showToast } from "@bernouy/components";
import { CMS_SOURCE_REFRESH_FAILED_EVENT, CMS_SOURCE_SUCCESS_EVENT } from "@bernouy/components/binding";

export const OPERATION_AWAITING_READ = "data-operation-awaiting-read";

/** A completed mutation is never submitted again to recover its failed shared read. */
export function trackOperationCompletion(
    host: HTMLElement,
    formId: string,
    complete: (body: unknown, row: string) => void,
) {
    let submittedScope = "";
    let submittedRow = "";
    let stopRead: (() => void) | undefined;
    const scope = () => `${host.dataset.sourceId ?? ""}\u0000${host.dataset.rowKey ?? ""}`;
    const owns = (event: Event) => (event.target as Element).getAttribute("id") === formId;
    const clear = () => {
        stopRead?.();
        stopRead = undefined;
        if (host.getAttribute(OPERATION_AWAITING_READ) === formId) {
            host.removeAttribute(OPERATION_AWAITING_READ);
        }
    };
    const success = (event: HTMLElementEventMap[typeof CMS_SOURCE_SUCCESS_EVENT]) => {
        if (!owns(event) || !host.isConnected || scope() !== submittedScope) {
            return;
        }
        clear();
        complete(event.detail.body, submittedRow);
    };
    const partial = (event: HTMLElementEventMap[typeof CMS_SOURCE_REFRESH_FAILED_EVENT]) => {
        if (!owns(event) || !host.isConnected || scope() !== submittedScope) {
            return;
        }
        const body = event.detail.body;
        host.setAttribute(OPERATION_AWAITING_READ, formId);
        showToast(
            "The operation completed, but the detail could not be reloaded. Retry the read before making further changes.",
            { type: "warning" },
        );
        stopRead?.();
        stopRead = observeSource(host, (state) => {
            if (state.disposed || !host.isConnected || scope() !== submittedScope) {
                clear();
                return;
            }
            if (
                (state.loaded || state.empty) &&
                !state.loading &&
                !state.refreshing &&
                !state.error &&
                !state.refreshError
            ) {
                clear();
                complete(body, submittedRow);
            }
        });
    };
    host.addEventListener(CMS_SOURCE_SUCCESS_EVENT, success);
    host.addEventListener(CMS_SOURCE_REFRESH_FAILED_EVENT, partial);
    return () => {
        submittedScope = scope();
        submittedRow = host.dataset.rowKey ?? "";
    };
}
