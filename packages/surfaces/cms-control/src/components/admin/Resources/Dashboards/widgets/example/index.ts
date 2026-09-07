import "../w-detail/WDetail";
import type { DashboardWDetail } from "../w-detail/WDetail";
import type { WDetailFieldValue } from "../w-detail/types";
import "../w-table/WTable";
import { setSourceData } from "@bernouy/components";
import { tableShell, type TableWidget } from "../w-table/composition";
import { tableRowsTemplate } from "../../runtime/mounting/mountSource";
import { detailData, isMediaItems, isStringArray, PRODUCTS, type ExampleProduct } from "./data";

export function mountDashboardWidgetExample(root: HTMLElement, selectedId: string | null): void {
    root.replaceChildren();
    const selected = selectedId ? (PRODUCTS.find((item) => item.id === selectedId) ?? null) : null;
    root.append(selected ? detailElement(selected) : tableElement());
}

export function updateDashboardWidgetExampleField(rowKey: string, field: string, value: WDetailFieldValue): void {
    const product = PRODUCTS.find((item) => item.id === rowKey);
    if (!product) {
        return;
    }
    if (field === "title" && typeof value === "string") {
        product.title = value;
    }
    if (field === "status" && typeof value === "string") {
        product.status = value;
    }
    if (field === "vendor" && typeof value === "string") {
        product.vendor = value;
    }
    if (field === "category" && typeof value === "string") {
        product.category = value;
    }
    if (field === "description" && typeof value === "string") {
        product.description = value;
    }
    if (field === "visibility" && typeof value === "string") {
        product.visibility = value;
    }
    if (field === "tags" && isStringArray(value)) {
        product.tags = value;
    }
    if (field === "media" && isMediaItems(value)) {
        product.media = value;
    }
}

function tableElement(): HTMLElement {
    const widget: TableWidget = {
        widget: "w-table",
        id: "example-products",
        title: "Products",
        source: { endpoint: "" },
        rowKey: "id",
        selection: { opens: "example-products" },
        columns: [
            { id: "title", path: "title", label: "Product", primary: true },
            { id: "status", path: "status", label: "Status", format: "badge", width: "140px" },
            { id: "vendor", path: "vendor", label: "Vendor", width: "160px" },
            { id: "category", path: "category", label: "Category", width: "180px" },
            { id: "updated", path: "updated", label: "Updated", width: "140px" },
        ],
    };
    const element = tableShell(widget);
    element.setAttribute("subtitle", "Widget sandbox: selection and bulk checkboxes only.");
    element.setAttribute("cms-source", "");
    const rows = tableRowsTemplate(widget);
    rows.querySelector('[column="updated"]')!.setAttribute("tone", "muted");
    element.append(rows);
    setSourceData(element, { dashboardData: PRODUCTS });
    return element;
}

function detailElement(product: ExampleProduct): DashboardWDetail {
    const element = document.createElement("cms-dashboard-w-detail") as unknown as DashboardWDetail;
    element.data = detailData(product);
    return element;
}
