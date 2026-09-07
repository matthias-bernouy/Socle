import { showToast } from "@bernouy/components";
import type { DashboardField, DashboardWidget } from "@bernouy/cms-dashboards";
import type { RenderContext } from "../../../../../domain";
import { valueAt } from "../../../../expressions";
import { emitWidgetEvent, WIDGET_FIELD_CHANGE_EVENT } from "../../../../../widgets/shared";
import {
    W_MEDIA_FIELD_ACTION_EVENT,
    type DashboardMediaActionDetail,
    type DashboardMediaItem,
} from "../../../../../widgets/w-media-field/types";
import type { DashboardMediaField } from "../../../../../widgets/w-media-field/binding/MediaField";
import markup from "cms-control/static/admin/_content/sources/_runtime/forms/upload.html" with { type: "text" };
import { submitMediaUpload } from "./upload";

type Detail = Extract<DashboardWidget, { widget: "w-detail" }>;
type Media = Extract<DashboardField, { type: "media" }>;
type Host = HTMLElement & { applyFieldDraft(field: string, value: unknown): void };
type Upload = { field: Media; queue: Promise<void>; sessionId?: string };
const owners = new WeakMap<HTMLElement, Map<string, Upload>>();

export function composeMediaForms(host: HTMLElement, widget: Detail, context: RenderContext): void {
    const uploads = new Map<string, Upload>();
    for (const field of [...widget.main, ...(widget.aside ?? [])].flatMap((section) =>
        "fields" in section ? section.fields : [],
    )) {
        if (field.type !== "media" || field.persist !== "save") {
            continue;
        }
        const template = document.createElement("template");
        template.innerHTML = markup as unknown as string;
        const form = template.content.firstElementChild as HTMLFormElement;
        form.dataset.mediaField = field.id;
        form.setAttribute("cms-source", `{{ detailMediaUploadUrls.${field.id} }} as stagedMedia`);
        const ref = field.actions?.upload;
        if (ref) {
            const sourceId = ref.sourceId ?? context.dashboard.source;
            const endpoint = (context.groups ?? [context.group])
                .find((group) => group.source.id === sourceId)
                ?.endpoints.find((entry) => entry.endpointId === ref.endpoint);
            if (!endpoint || !["POST", "PUT", "PATCH"].includes(endpoint.method)) {
                throw new Error("A staged media upload must use a declared write endpoint.");
            }
            if (ref.body && Object.keys(ref.body).length) {
                throw new Error("Staged media uploads use their file input and stable endpoint parameters.");
            }
            form.setAttribute("cms-source-method", endpoint.method);
        }
        if (field.staging) {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = field.staging.sessionField;
            input.setAttribute("cms-form-empty", "omit");
            input.setAttribute("value", `{{ detailUploadSessions.${field.id} }}`);
            host.querySelector("[data-detail-save]")?.append(input);
        }
        uploads.set(field.id, { field, queue: Promise.resolve() });
        host.append(form);
    }
    owners.set(host, uploads);
}

export function connectMediaForms(host: Host): () => void {
    const abort = new AbortController();
    const uploads = owners.get(host);
    const apply = (field: string, value: DashboardMediaItem[]) => {
        host.applyFieldDraft(field, value);
        emitWidgetEvent(host, WIDGET_FIELD_CHANGE_EVENT, { rowKey: host.dataset.rowKey ?? "", field, value });
    };
    const onAction = (event: Event) => {
        if ((event.target as Element).closest("cms-dashboard-w-detail") !== host) {
            return;
        }
        const control = event
            .composedPath()
            .find(
                (node): node is DashboardMediaField =>
                    node instanceof HTMLElement && node.localName === "cms-dashboard-media-field",
            );
        const upload = uploads?.get(control?.dataset.fieldControl ?? "");
        if (!upload || !control) {
            return;
        }
        event.stopImmediatePropagation();
        const detail = (event as CustomEvent<DashboardMediaActionDetail>).detail;
        apply(upload.field.id, detail.value);
        const files = detail.files ?? (detail.file ? [detail.file] : []);
        const pending =
            detail.action === "replace"
                ? [detail.value[detail.index!]].filter(Boolean)
                : detail.value.filter(
                      (item) =>
                          item.pending && !(detail.previousValue ?? []).some((previous) => previous.id === item.id),
                  );
        for (const [index, file] of files.entries()) {
            const item = pending[index];
            if (!item) {
                continue;
            }
            const row = host.dataset.rowKey;
            upload.queue = upload.queue.then(async () => {
                if (abort.signal.aborted || row !== host.dataset.rowKey) {
                    return;
                }
                try {
                    if (!upload.field.actions?.upload) {
                        throw new Error("No staged upload endpoint is configured.");
                    }
                    const form = Array.from(host.querySelectorAll<HTMLFormElement>("[data-media-upload]")).find(
                        (candidate) => candidate.dataset.mediaField === upload.field.id,
                    );
                    if (!form) {
                        throw new Error("The staged upload form is unavailable.");
                    }
                    const result = await submitMediaUpload(form, file, abort.signal);
                    if (abort.signal.aborted || row !== host.dataset.rowKey) {
                        return;
                    }
                    const sessionId = valueAt(result, "sessionId");
                    if (
                        typeof sessionId !== "string" ||
                        !sessionId ||
                        (upload.sessionId && upload.sessionId !== sessionId)
                    ) {
                        throw new Error("The upload returned an invalid session reference.");
                    }
                    upload.sessionId = sessionId;
                    const id = valueAt(result, "media.id");
                    if ((typeof id !== "string" && typeof id !== "number") || !String(id)) {
                        throw new Error("The upload returned no usable media identifier.");
                    }
                    apply(
                        upload.field.id,
                        control.items.map((current) =>
                            current.url === item.url ? { ...current, id: String(id), pending: false } : current,
                        ),
                    );
                } catch (error) {
                    if (abort.signal.aborted || row !== host.dataset.rowKey) {
                        return;
                    }
                    apply(
                        upload.field.id,
                        control.items.flatMap((current) =>
                            current.url !== item.url ? [current] : detail.previousItem ? [detail.previousItem] : [],
                        ),
                    );
                    showToast(error instanceof Error ? error.message : "Image upload failed", { type: "error" });
                }
            });
        }
    };
    host.addEventListener(W_MEDIA_FIELD_ACTION_EVENT, onAction, true);
    return () => {
        abort.abort();
        host.removeEventListener(W_MEDIA_FIELD_ACTION_EVENT, onAction, true);
    };
}

/** Only scalar upload-session references enter the shared form context. */
export function mediaUploadSessions(host: HTMLElement): Record<string, string> {
    return Object.fromEntries(Array.from(owners.get(host) ?? []).map(([id, upload]) => [id, upload.sessionId ?? ""]));
}
