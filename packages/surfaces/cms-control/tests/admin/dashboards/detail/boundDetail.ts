import "cms-control/components";
import { READY_ATTR, setSourceData } from "@bernouy/components";
import type { DashboardField } from "@bernouy/cms-dashboards";
import { DashboardWDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/WDetail";
import { composeDetail } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/binding/composition";
import type { DetailWidget } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/runtime/fieldState";
import { waitForDetail } from "./detailTestHelpers";

/** Tests compose the real declarations and let the page core apply their data. */
export function configureDetail(detail: HTMLElement, widget: DetailWidget): void {
    (detail as DashboardWDetail).configure(widget);
    detail.dataset.widgetId = widget.id;
    detail.setAttribute("cms-source", "");
    detail.append(composeDetail(widget));
}

export async function mountDetail(detail: HTMLElement): Promise<void> {
    const core = document.createElement("cms-binding-core");
    core.append(detail);
    document.body.append(core);
    await waitForDetail(() => detail.hasAttribute(READY_ATTR));
}

export async function mountDetailFields(
    fields: DashboardField[],
    values: Record<string, unknown>,
): Promise<DashboardWDetail> {
    const detail = new DashboardWDetail();
    configureDetail(detail, {
        widget: "w-detail",
        id: "fields",
        source: { endpoint: "" },
        main: [{ id: "fields", title: "Fields", fields }],
    });
    setSourceData(detail, values);
    await mountDetail(detail);
    return detail;
}

export { setSourceData };
