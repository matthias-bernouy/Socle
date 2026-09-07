import type { DashboardField } from "@bernouy/cms-dashboards";
import type { Page } from "playwright";
import { installReadonlyRoutes } from "../../fixture";

export const reorderablePage =
    "http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=quality-choices";

export async function installReorderableRoutes(
    page: Page,
    bundle: string,
    styles: string,
    layout: "rows" | "cards" = "rows",
) {
    const resource = {
        id: "quality-choices",
        title: "Allowed choices",
        notes: "Saved notes",
        choices: [
            {
                id: "agency",
                metadata: { label: "Agency", hidden: "first" },
                required: false,
                status: "active",
                brand: "wilson",
                order: { position: 0, hidden: true },
                audit: { owner: "first" },
            },
            {
                id: "client",
                metadata: { label: "Client", hidden: "second" },
                required: true,
                status: "inactive",
                brand: "head",
                order: { position: 1, hidden: true },
                audit: { owner: "second" },
            },
        ],
    };
    const field: DashboardField = {
        id: "choices",
        path: "choices",
        label: "Choices",
        type: "reorderable-list",
        itemKey: "id",
        positionPath: "order.position",
        layout,
        addLabel: "Add choice",
        minItems: 1,
        maxItems: 3,
        fields: [
            { id: "label", path: "metadata.label", label: "Label", required: true },
            { id: "required", path: "required", label: "Required", type: "checkbox" },
            {
                id: "status",
                path: "status",
                label: "Status",
                type: "select",
                secondary: true,
                options: [
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                ],
            },
            {
                id: "brand",
                path: "brand",
                label: "Brand",
                type: "combobox",
                secondary: true,
                lookup: { endpoint: "brands", itemsPath: "items", valuePath: "id", labelPath: "label" },
            },
        ],
    };
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        resource,
        normalize: (value) => Object.assign(resource, value),
        fields: [
            { id: "title", path: "title", label: "Title", type: "text" },
            field,
            { id: "notes", path: "notes", label: "Notes", type: "textarea" },
        ],
        extraEndpoints: [{ endpointId: "brands", method: "GET", params: [] }],
    });
    const lookups: number[] = [];
    let pending: Promise<void> | undefined;
    await page.route("**/.cms/sources/store/brands*", async (route) => {
        lookups.push(performance.now());
        await pending;
        await route.fulfill({
            json: {
                items: [
                    { id: "wilson", label: "Wilson" },
                    { id: "head", label: "Head" },
                ],
            },
        });
    });
    return {
        ...fixture,
        resource,
        lookups,
        holdLookup() {
            let release = () => {};
            pending = new Promise<void>((resolve) => {
                release = resolve;
            });
            return release;
        },
    };
}
