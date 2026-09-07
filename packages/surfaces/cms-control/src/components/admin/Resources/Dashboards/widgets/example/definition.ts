import type { DashboardWidget } from "@bernouy/cms-dashboards";

export const exampleDetail: Extract<DashboardWidget, { widget: "w-detail" }> = {
    widget: "w-detail",
    id: "example-products",
    source: { endpoint: "" },
    title: { path: "title" },
    status: { path: "status" },
    actions: [
        { label: "Save changes", tone: "primary", id: "save" },
        { label: "Duplicate", id: "duplicate" },
        { label: "Preview", id: "preview" },
        { label: "Copy link", id: "copy-link", section: "Share", icon: "link" },
        { label: "Export", id: "export", section: "Share", icon: "download" },
        { label: "Archive product", tone: "danger", id: "archive", section: "Other actions", icon: "archive" },
        { label: "Delete product", tone: "danger", id: "delete", section: "Other actions", icon: "trash" },
    ],
    main: [
        {
            id: "general",
            title: "General",
            fields: [
                { id: "title", label: "Title", type: "text", path: "title" },
                { id: "description", label: "Description", type: "textarea", path: "description" },
                {
                    id: "media",
                    label: "Media",
                    type: "media",
                    path: "media",
                    item: { idPath: "id", urlPath: "url", altPath: "alt" },
                },
                { id: "category", label: "Category", type: "text", path: "category" },
            ],
        },
    ],
    aside: [
        {
            id: "status",
            title: "Status",
            fields: [
                {
                    id: "status",
                    label: "Publication",
                    type: "select",
                    path: "status",
                    options: options("Active", "Draft", "Archived"),
                },
                {
                    id: "visibility",
                    label: "Visibility",
                    type: "select",
                    path: "visibility",
                    options: options("Online store", "Hidden"),
                },
            ],
        },
        {
            id: "organization",
            title: "Organization",
            fields: [
                {
                    id: "vendor",
                    label: "Vendor",
                    type: "combobox",
                    path: "vendor",
                    options: options("Acme", "Example Supply", "Northwind", "Paper & Co."),
                    allowCustom: true,
                },
                {
                    id: "tags",
                    label: "Tags",
                    type: "tokens",
                    path: "tags",
                    options: options("Featured", "New", "Seasonal"),
                    allowCustom: true,
                },
                { id: "id", label: "Resource id", type: "readonly", path: "id" },
            ],
        },
    ],
};

function options(...values: string[]): Array<{ label: string; value: string }> {
    return values.map((value) => ({ label: value, value }));
}
