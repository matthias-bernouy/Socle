import { observeSource, type BindingRequestResult } from "@bernouy/components";

/** Transfer the selected file to the independent multipart form; page binding owns transport. */
export function submitMediaUpload(form: HTMLFormElement, file: File, signal: AbortSignal): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let finished = false;
        let stop: (() => void) | undefined;
        const finish = (error?: Error, body?: unknown) => {
            if (finished) {
                return;
            }
            finished = true;
            stop?.();
            form.removeEventListener("cms-source:success", result);
            form.removeEventListener("cms-source:failed", result);
            signal.removeEventListener("abort", abort);
            if (error) {
                reject(error);
            } else {
                resolve(body);
            }
        };
        const abort = () => finish(new DOMException("The detail was closed", "AbortError"));
        const result = (event: Event) => {
            if (event.target !== form) {
                return;
            }
            const response = (event as CustomEvent<BindingRequestResult>).detail;
            finish(response.ok ? undefined : new Error(response.message || "Image upload failed"), response.body);
        };
        if (signal.aborted || !form.isConnected) {
            abort();
            return;
        }
        form.addEventListener("cms-source:success", result);
        form.addEventListener("cms-source:failed", result);
        signal.addEventListener("abort", abort, { once: true });
        let started = false;
        stop = observeSource(form, (state) => {
            if (state.disposed) {
                abort();
            } else if (!started) {
                started = true;
                queueMicrotask(() => {
                    if (finished || !form.isConnected) {
                        return;
                    }
                    try {
                        const transfer = new DataTransfer();
                        transfer.items.add(file);
                        form.querySelector<HTMLInputElement>('input[type="file"]')!.files = transfer.files;
                        form.requestSubmit();
                    } catch (error) {
                        finish(error instanceof Error ? error : new Error(String(error)));
                    }
                });
            }
        });
    });
}
