import type { DashboardDto } from "@bernouy/cms-dashboards";
export const dashboard: DashboardDto = {
    id: "catalogue",
    source: "store",
    meta: { name: "Catalogue" },
    views: [
        {
            widget: "w-table",
            id: "products",
            title: "Products",
            source: { endpoint: "items", itemsPath: "items", params: { q: "$filter.q", status: "$filter.status" } },
            rowKey: "id",
            selection: { opens: "detail" },
            columns: [
                { id: "name", path: "name", label: "Name", primary: true, width: "240px" },
                { id: "status", path: "status", label: "Status", format: "badge", width: "140px" },
                { id: "price", path: "price", label: "Price", format: "money", width: "160px" },
                { id: "updated", path: "updated", label: "Updated", format: "date", width: "180px" },
            ],
            filters: [
                { id: "q", label: "Search", type: "text", placeholder: "Search products" },
                {
                    id: "status",
                    label: "Status",
                    type: "select",
                    options: [
                        { value: "active", label: "Active" },
                        { value: "draft", label: "Draft" },
                    ],
                },
            ],
            actions: [
                { id: "new", label: "New product", selection: { opens: "detail" } },
                {
                    id: "export",
                    label: "Export",
                    endpoint: { endpoint: "export" },
                    download: { filename: "products.csv" },
                },
                {
                    id: "clear",
                    label: "Clear products",
                    tone: "danger",
                    confirm: "Clear test products?",
                    form: { endpoint: "clear" },
                },
            ],
        },
        {
            widget: "w-detail",
            id: "detail",
            source: { endpoint: "item", params: { id: "$selection.id" } },
            title: { path: "name", fallback: "New product" },
            main: [
                {
                    id: "main",
                    title: "Product",
                    fields: [{ id: "name", label: "Name", path: "name", type: "text", required: true }],
                },
            ],
            create: {},
            save: {
                endpoint: "save",
                label: "Save product",
                hiddenFields: [{ name: "id", type: "string", value: "$resource.id", empty: "omit" }],
            },
        },
    ],
};
