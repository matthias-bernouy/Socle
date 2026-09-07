import type { DashboardField, DashboardWidget } from "@bernouy/cms-dashboards";
import type { IntegrationSettingsResponse } from "@bernouy/cms-integrations";
import { setSourceData } from "@bernouy/components";
import { composeDetail } from "../../Dashboards/widgets/w-detail/binding/composition";
import { setValueAt } from "../../Dashboards/runtime/expressions";
import { DashboardWDetail } from "../../Dashboards/widgets/w-detail/WDetail";
import { WIDGET_ACTION_EVENT, type WidgetActionDetail } from "../../Dashboards/widgets/shared";

export function renderSettings(
    root: HTMLElement,
    fields: DashboardField[],
    settings: IntegrationSettingsResponse,
    save: (values: Record<string, unknown>) => void,
): void {
    const widget: Extract<DashboardWidget, { widget: "w-detail" }> = {
        widget: "w-detail",
        id: "connection-settings",
        source: { endpoint: "" },
        title: { path: "", fallback: "Connection" },
        actions: [{ label: "Save settings", id: "save-settings", tone: "primary" }],
        main: [{ id: "configuration", title: "Configuration", fields }],
    };
    const editor = new DashboardWDetail();
    editor.configure(widget);
    editor.dataset.rowKey = "settings";
    editor.setAttribute("cms-source", "");
    editor.append(composeDetail(widget));
    setSourceData(editor, settings.values);
    editor.addEventListener(WIDGET_ACTION_EVENT, (event) => {
        event.stopPropagation();
        const detail = (event as CustomEvent<WidgetActionDetail>).detail;
        if (detail.action !== "save-settings") {
            return;
        }
        const values = structuredClone(settings.values);
        for (const field of fields) {
            if (detail.fields && Object.hasOwn(detail.fields, field.id)) {
                setValueAt(values, field.path, detail.fields[field.id]);
            }
        }
        save(values);
    });
    root.replaceChildren(editor);
}
