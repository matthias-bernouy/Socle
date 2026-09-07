import type { DashboardField, DashboardWidget } from "@bernouy/cms-dashboards";
import type { IntegrationSettingsResponse } from "@bernouy/cms-integrations";
import { readSourceData } from "@bernouy/components";
import { composeDetail } from "../../Dashboards/widgets/w-detail/binding/composition";
import { setValueAt } from "../../Dashboards/runtime/expressions";
import { DashboardWDetail } from "../../Dashboards/widgets/w-detail/WDetail";
import { WIDGET_ACTION_EVENT, type WidgetActionDetail } from "../../Dashboards/widgets/shared";
import { route } from "../api";
import markup from "cms-control/static/admin/_content/sources/_management/settings.html" with { type: "text" };

/** Compose from the field contract; binding reads and applies the settings response. */
export function mountSettings(
    root: HTMLElement,
    fields: DashboardField[],
    installationId: string,
    save: (editor: DashboardWDetail, values: Record<string, unknown>, submitted: Record<string, unknown>) => void,
    apply?: () => void,
): DashboardWDetail {
    const widget: Extract<DashboardWidget, { widget: "w-detail" }> = {
        widget: "w-detail",
        id: "connection-settings",
        source: { endpoint: "", itemPath: "values" },
        title: { path: "", fallback: "Connection" },
        actions: [{ label: "Save settings", id: "save-settings", tone: "primary" }],
        main: [{ id: "configuration", title: "Configuration", fields }],
    };
    const editor = new DashboardWDetail();
    editor.configure(widget);
    editor.dataset.rowKey = "settings";
    editor.setAttribute(
        "cms-source",
        `${route("/api/integrations/management/settings")}?id=${encodeURIComponent(installationId)} as settings`,
    );
    const reload = `integration:${encodeURIComponent(installationId)}:settings:reload`;
    editor.setAttribute("cms-reload-on", reload);
    const template = document.createElement("template");
    template.innerHTML = markup as unknown as string;
    if (!apply) {
        template.content.querySelector("[data-management-action]")!.remove();
    }
    editor.append(template.content.cloneNode(true), composeDetail(widget));
    editor.addEventListener("click", (event) => {
        const target = event.target as Element | null;
        if (target?.closest("[data-settings-retry]")) {
            editor.ownerDocument.dispatchEvent(new Event(reload));
        } else if (target?.closest("[data-management-action]")) {
            apply?.();
        }
    });
    editor.addEventListener(WIDGET_ACTION_EVENT, (event) => {
        event.stopPropagation();
        const detail = (event as CustomEvent<WidgetActionDetail>).detail;
        const settings = readSourceData(editor) as IntegrationSettingsResponse | undefined;
        if (detail.action !== "save-settings" || !settings?.values) {
            return;
        }
        const submitted = structuredClone(detail.fields ?? {});
        const values = structuredClone(settings.values);
        for (const field of fields) {
            if (Object.hasOwn(submitted, field.id)) {
                setValueAt(values, field.path, submitted[field.id]);
            }
        }
        save(editor, values, submitted);
    });
    root.replaceChildren(editor);
    return editor;
}
