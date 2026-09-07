import type { DashboardField } from "@bernouy/cms-dashboards";
import type { DetailWidget } from "cms-control/components/admin/Resources/Dashboards/widgets/w-detail/runtime/fieldState";
import { configureDetail } from "./boundDetail";
export function detailElement(widget: DetailWidget): HTMLElement {
    const detail = document.createElement("cms-dashboard-w-detail");
    configureDetail(detail, widget);
    return detail;
}

export function sharedLookupWidget(): DetailWidget {
    const lookup = {
        endpoint: "brands",
        params: { categoryId: "$field.categoryId" },
        itemsPath: "items",
        valuePath: "id",
        labelPath: "name",
    };
    return widget([
        { id: "categoryId", label: "Category", path: "categoryId", type: "text" },
        { id: "brandId", label: "Brand", path: "brandId", type: "combobox", lookup },
        { id: "secondaryBrandId", label: "Secondary brand", path: "secondaryBrandId", type: "combobox", lookup },
        {
            id: "metadata",
            label: "Metadata",
            path: "metadata",
            type: "schema",
            schema: {
                endpoint: "brands",
                params: { categoryId: "$field.categoryId" },
                itemsPath: "fields",
            },
        },
    ]);
}

export function singleLookupWidget(): DetailWidget {
    return {
        ...widget([
            {
                id: "productId",
                label: "Product",
                path: "productId",
                type: "combobox",
                lookup: {
                    endpoint: "products",
                    params: { ownerId: "$resource.id" },
                    itemsPath: "items",
                    valuePath: "id",
                    labelPath: "title",
                },
            },
        ]),
        title: { path: "title", fallback: "Product" },
    };
}

function widget(fields: DashboardField[]): DetailWidget {
    return {
        widget: "w-detail",
        id: "detail",
        source: { endpoint: "resource" },
        main: [{ id: "main", title: "Main", fields }],
    };
}
