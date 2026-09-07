import type { Page } from "playwright";
import { installReadonlyRoutes } from "../fixture";

export function installConditionalRoutes(page: Page, bundle: string, styles: string) {
    return installReadonlyRoutes(page, bundle, styles, {
        resource: { name: "Initial", mode: "basic", role: "admin", note: "", decimals: false, price: 1500 },
        fields: [
            { id: "name", label: "Name", path: "name", type: "text", required: true },
            {
                id: "mode",
                label: "Mode",
                path: "mode",
                type: "select",
                options: [
                    { value: "basic", label: "Basic" },
                    { value: "advanced", label: "Advanced" },
                ],
            },
            {
                id: "note",
                label: "Note",
                path: "note",
                type: "text",
                required: true,
                visibleWhen: {
                    all: [
                        { value: "$field.mode", equals: "advanced" },
                        {
                            any: [
                                { value: "$resource.role", equals: "admin" },
                                { value: "$field.decimals", equals: true },
                            ],
                        },
                    ],
                },
            },
            { id: "decimals", label: "Decimals", path: "decimals", type: "checkbox" },
            {
                id: "price",
                label: "Price",
                path: "price",
                type: "money",
                allowDecimals: { value: "$field.decimals", equals: true },
            },
        ],
        normalize: (value) => ({ ...value, name: String(value.name).trim() }),
    });
}
