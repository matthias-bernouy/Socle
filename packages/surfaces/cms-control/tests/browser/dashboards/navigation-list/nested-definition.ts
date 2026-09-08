import type { DashboardDto, DashboardWidget } from "@bernouy/cms-dashboards";

const children: DashboardWidget = {
    widget: "w-navigation-list",
    id: "children",
    title: "Questions",
    source: { endpoint: "children", params: { context: "$selection.parent.id" }, itemsPath: "items" },
    rowKey: "id",
    item: { title: { path: "name" }, subtitle: { path: "id" } },
    selection: { opens: "child" },
    reorderable: { action: "reorder" },
    actions: [
        {
            id: "clear",
            label: "Clear questions",
            confirm: "Clear test questions?",
            tone: "danger",
            form: { endpoint: "clear" },
        },
        { id: "reorder", label: "Reorder", form: { endpoint: "reorder" } },
    ],
};
const parent: DashboardWidget = {
    widget: "w-detail",
    id: "parent",
    source: { endpoint: "parent" },
    title: { path: "name" },
    save: { endpoint: "saveParent", label: "Save section" },
    main: [
        {
            id: "heading",
            title: "Heading",
            fields: [{ id: "name", path: "name", label: "Name", type: "text", required: true }],
        },
        children,
        { id: "notes", title: "Notes", fields: [{ id: "note", path: "note", label: "Note", type: "textarea" }] },
    ],
};
export const dashboard: DashboardDto = {
    id: "forms",
    source: "forms",
    meta: { name: "Forms" },
    views: [
        {
            widget: "w-section",
            id: "outer",
            title: "Form settings",
            children: [
                {
                    widget: "w-tabs",
                    id: "tabs",
                    tabs: [
                        { id: "edit", label: "Edit", children: [parent] },
                        {
                            id: "info",
                            label: "Information",
                            children: [
                                {
                                    widget: "w-section",
                                    id: "infoSection",
                                    title: "Information",
                                    children: [
                                        {
                                            widget: "w-detail",
                                            id: "info",
                                            source: { endpoint: "info" },
                                            title: { path: "name", fallback: "About this form" },
                                            main: [
                                                {
                                                    id: "info",
                                                    title: "Description",
                                                    fields: [
                                                        { id: "text", path: "text", label: "Text", type: "readonly" },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            widget: "w-detail",
            id: "child",
            source: { endpoint: "child", params: { id: "$selection.id" } },
            title: { path: "name" },
            main: [
                {
                    id: "main",
                    title: "Question",
                    fields: [{ id: "name", path: "name", label: "Name", type: "text", required: true }],
                },
            ],
            save: {
                endpoint: "saveChild",
                label: "Save question",
                hiddenFields: [{ name: "id", type: "string", value: "$resource.id" }],
            },
        },
    ],
};
