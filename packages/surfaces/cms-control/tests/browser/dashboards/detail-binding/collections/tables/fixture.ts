import type { DashboardField } from "@bernouy/cms-dashboards";
import type { Page } from "playwright";
import { installReadonlyRoutes } from "../../fixture";

export const tablePage =
    "http://cms.test/admin/sources?source=store&dashboard=summary&collection=detail&row=quality-table";

const fields: DashboardField[] = [
    { id: "title", path: "title", label: "Title", type: "text" },
    {
        id: "axes",
        path: "axes",
        label: "Variant axes",
        type: "table",
        editable: true,
        addLabel: "Add axis",
        columns: [
            { id: "label", path: "details.label", label: "Label", editable: true },
            { id: "values", path: "details.values", label: "Values", editable: true, type: "tokens" },
            {
                id: "status",
                path: "status",
                label: "Status",
                editable: true,
                type: "select",
                options: [
                    { value: "", label: "None" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                ],
            },
            {
                id: "brand",
                path: "brand",
                label: "Brand",
                editable: true,
                type: "combobox",
                lookup: { endpoint: "brands", itemsPath: "items", valuePath: "id", labelPath: "label" },
            },
        ],
    },
    {
        id: "matrix",
        path: "matrix",
        label: "Variant matrix",
        type: "table",
        derive: { type: "cartesian", sourceField: "axes", labelPath: "details.label", valuesPath: "details.values" },
        columns: [
            { id: "options", path: "options", label: "Options" },
            { id: "title", path: "title", label: "Variant" },
            { id: "status", path: "status", label: "Status" },
        ],
    },
    {
        id: "prices",
        path: "prices",
        label: "Prices",
        type: "table",
        columns: [
            { id: "label", path: "label", label: "Label" },
            { id: "amount", path: "price.amount", label: "Price", format: "money" },
            { id: "date", path: "date", label: "Date", format: "date" },
        ],
    },
    { id: "notes", path: "notes", label: "Notes", type: "textarea" },
];

export async function installTableRoutes(page: Page, bundle: string, styles: string, conditional = false) {
    const resource = {
        id: "quality-table",
        title: "Product variants",
        showAxes: true,
        notes: "Saved notes",
        axes: [
            {
                id: "grip",
                details: { label: "Grip", values: ["L1", "L2"], hidden: "first" },
                status: "active",
                brand: "wilson",
                audit: { owner: "first" },
            },
            {
                id: "weight",
                details: { label: "Weight", values: ["300"], hidden: "second" },
                status: "inactive",
                brand: "head",
                audit: { owner: "second" },
            },
        ],
        matrix: [
            {
                key: "grip:l1|weight:300",
                options: "L1 / 300",
                title: "Grip: L1 / Weight: 300",
                status: "inactive",
                position: 0,
            },
            {
                key: "grip:l2|weight:300",
                options: "L2 / 300",
                title: "Grip: L2 / Weight: 300",
                status: "inactive",
                position: 1,
            },
        ],
        prices: [
            { id: "eur", label: "Europe", price: { amount: 1299, currency: "EUR" }, date: "2026-09-07", hidden: true },
            { id: "usd", label: "America", price: { amount: 2500 }, currency: "USD", date: "2026-09-08" },
        ],
    };
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        fields: conditional
            ? [
                  { id: "showAxes", path: "showAxes", label: "Show axes", type: "checkbox" },
                  ...fields.map((field) =>
                      field.id === "axes"
                          ? { ...field, visibleWhen: { value: "$field.showAxes", equals: true } }
                          : field,
                  ),
              ]
            : fields,
        resource,
        normalize: (value) => Object.assign(resource, value),
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
