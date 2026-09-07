import type { Page } from "playwright";
import { installReadonlyRoutes } from "../fixture";

const advanced = { value: "$field.advanced", equals: true } as const;
export function installActionRoutes(page: Page, bundle: string, styles: string) {
    return installReadonlyRoutes(page, bundle, styles, {
        resource: { name: "Initial", advanced: false },
        fields: [
            { id: "name", label: "Name", path: "name", type: "text", required: true },
            { id: "advanced", label: "Advanced", path: "advanced", type: "checkbox" },
        ],
        actions: [
            { id: "review", label: "Review", visibleWhen: advanced, tone: "primary" },
            { id: "refresh", label: "Refresh" },
            { id: "export", label: "Export", icon: "download", section: "Exports" },
            {
                id: "archive",
                label: "Archive",
                icon: "archive",
                placement: "more",
                section: "Maintenance",
                visibleWhen: advanced,
            },
            {
                id: "remove",
                label: "Remove",
                icon: "trash",
                tone: "danger",
                placement: "more",
                section: "Maintenance",
                visibleWhen: advanced,
                confirm: "Remove the test flag?",
                endpoint: { endpoint: "save", body: { advanced: "false" } },
                after: { resource: "$result" },
            },
            {
                id: "preview",
                label: "Preview",
                icon: "link",
                placement: "more",
                section: "Exports",
                visibleWhen: advanced,
            },
        ],
        normalize: (resource) => ({
            ...resource,
            advanced: resource.advanced === true,
            name: String(resource.name).trim(),
        }),
    });
}
