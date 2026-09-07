import type { Page } from "playwright";
import { installReadonlyRoutes } from "../../fixture";

export async function installLookupRoutes(page: Page, bundle: string, styles: string, inlineCreate = false) {
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        extraEndpoints: inlineCreate ? [{ endpointId: "create-brand", method: "POST", params: [] }] : [],
        resource: {
            id: "lookup",
            title: "Lookups",
            name: "Initial",
            category: "tennis",
            brand: "historic",
            selected: { id: "historic", label: "Historic brand" },
        },
        fields: [
            { id: "name", path: "name", type: "text", label: "Name" },
            {
                id: "category",
                path: "category",
                type: "select",
                label: "Category",
                options: [
                    { value: "tennis", label: "Tennis" },
                    { value: "padel", label: "Padel" },
                ],
            },
            {
                id: "brand",
                path: "brand",
                type: "combobox",
                label: "Brand",
                lookup: {
                    endpoint: "brands",
                    itemsPath: "items",
                    valuePath: "id",
                    labelPath: "label",
                    totalPath: "total",
                    selected: "$resource.selected",
                    ...(inlineCreate
                        ? {
                              create: {
                                  mode: "inline" as const,
                                  endpoint: "create-brand",
                                  body: { label: "$value" },
                                  valuePath: "id",
                                  labelPath: "label",
                              },
                          }
                        : {}),
                    params: { category: "$field.category", q: "$search", limit: "$limit", offset: "$offset" },
                },
            },
        ],
    });
    const reads: string[] = [];
    const holds = new Map<string, Promise<void>>();
    const failures = new Set<string>();
    await page.route("**/.cms/sources/store/brands?**", async (route) => {
        const url = new URL(route.request().url());
        reads.push(url.search);
        const q = url.searchParams.get("q") ?? "";
        const offset = Number(url.searchParams.get("offset"));
        await holds.get(q);
        if (failures.delete(q)) {
            await route.fulfill({ status: 503, json: { error: "Lookup failed" } });
            return;
        }
        await route.fulfill({
            json: {
                total: 27,
                items: Array.from({ length: offset ? 2 : 25 }, (_, i) => ({
                    id: `brand-${offset + i}`,
                    label: `${q || url.searchParams.get("category")} Brand ${offset + i}`,
                })),
            },
        });
    });
    return {
        ...fixture,
        reads,
        fail(query: string) {
            failures.add(query);
        },
        hold(query: string) {
            let release = () => {};
            holds.set(
                query,
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
            );
            return release;
        },
    };
}
