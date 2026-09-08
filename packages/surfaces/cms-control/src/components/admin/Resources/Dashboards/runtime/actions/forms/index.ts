import { observeSource, type BindingRequestResult } from "@bernouy/components";
import template from "cms-control/static/admin/_content/sources/_runtime/action-form.html" with { type: "text" };

export type ActionSubmission = {
    url: string;
    method: string;
    file: File;
};
export type SubmitAction = (submission: ActionSubmission) => Promise<unknown>;

/** Own native multipart uploads; the page binding owns requests and results. */
export class ActionForms {
    private readonly pending = new Set<() => void>();

    constructor(private readonly host: HTMLElement) {}

    readonly submit: SubmitAction = (submission) => {
        if (!this.host.isConnected || !this.host.closest("cms-binding-core")) {
            return Promise.reject(new Error("The action form is not connected to page binding"));
        }
        const fragment = document.createElement("template");
        fragment.innerHTML = template as unknown as string;
        const form = fragment.content.firstElementChild as HTMLFormElement;
        form.setAttribute("cms-source", `${submission.url} as result`);
        form.setAttribute("cms-source-method", submission.method);
        return new Promise((resolve, reject) => {
            let settled = false;
            let started = false;
            let stop: (() => void) | undefined;
            const finish = (error?: Error, body?: unknown) => {
                if (settled) {
                    return;
                }
                settled = true;
                stop?.();
                this.pending.delete(cancel);
                form.remove();
                if (error) {
                    reject(error);
                } else {
                    resolve(body);
                }
            };
            const cancel = () => finish(new DOMException("The action form was disconnected", "AbortError"));
            const result = (event: Event) => {
                if (event.target !== form) {
                    return;
                }
                const detail = (event as CustomEvent<BindingRequestResult>).detail;
                finish(
                    detail.ok ? undefined : new Error(detail.message || `Request failed (${detail.status})`),
                    detail.body,
                );
            };
            form.addEventListener("cms-source:success", result);
            form.addEventListener("cms-source:failed", result);
            this.pending.add(cancel);
            stop = observeSource(form, (state) => {
                if (state.disposed) {
                    cancel();
                } else if (!started) {
                    started = true;
                    queueMicrotask(() => {
                        if (settled || !form.isConnected) {
                            return;
                        }
                        try {
                            if (submission.file) {
                                const transfer = new DataTransfer();
                                transfer.items.add(submission.file);
                                form.querySelector<HTMLInputElement>("[data-submission-file]")!.files = transfer.files;
                            }
                            form.requestSubmit();
                        } catch (error) {
                            finish(error instanceof Error ? error : new Error(String(error)));
                        }
                    });
                }
            });
            this.host.append(form);
        });
    };

    disconnect(): void {
        for (const cancel of [...this.pending]) {
            cancel();
        }
    }
}
