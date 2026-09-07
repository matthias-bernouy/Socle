import type { Page } from "playwright";
import { installReadonlyRoutes } from "../../../fixture";

export async function installRemoteChoices(page: Page, bundle: string, styles: string) {
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        resource: {
            title: "Shared choice options",
            category: "tennis",
            rows: [
                { id: "first", label: "First", brand: "brand-0", supplier: "supplier-0", position: 0 },
                { id: "second", label: "Second", brand: "brand-1", supplier: "supplier-1", position: 1 },
            ],
        },
        fields: [
            {
                id: "category",
                path: "category",
                label: "Category",
                type: "select",
                options: [
                    { value: "tennis", label: "Tennis" },
                    { value: "padel", label: "Padel" },
                    { value: "", label: "None" },
                ],
            },
            {
                id: "rows",
                path: "rows",
                label: "Rows",
                type: "reorderable-list",
                itemKey: "id",
                fields: [
                    { id: "label", path: "label", label: "Label" },
                    ...["brand", "supplier"].map((id) => ({
                        id,
                        path: id,
                        label: id,
                        type: "combobox" as const,
                        lookup: {
                            endpoint: id,
                            itemsPath: "items",
                            totalPath: "total",
                            valuePath: "id",
                            labelPath: "label",
                            params: { category: "$field.category", q: "$search", limit: "$limit", offset: "$offset" },
                        },
                    })),
                ],
            },
        ],
    });
    const reads: Array<{ kind: string; q: string; offset: number; category: string }> = [];
    const holds = new Map<string, Promise<void>>();
    const failures = new Set<string>();
    for (const kind of ["brand", "supplier"]) {
        await page.route(`**/.cms/sources/store/${kind}?**`, async (route) => {
            const params = new URL(route.request().url()).searchParams;
            const q = params.get("q") ?? "";
            const offset = Number(params.get("offset"));
            const category = params.get("category") ?? "";
            reads.push({ kind, q, offset, category });
            await holds.get(q);
            if (failures.delete(q)) {
                await route.fulfill({ status: 503, json: { error: "Options unavailable" } });
                return;
            }
            await route.fulfill({
                json: {
                    total: 27,
                    items: Array.from({ length: offset ? 2 : 25 }, (_, index) => ({
                        id: `${kind}-${index + offset}`,
                        label: `${q || category} ${kind} ${index + offset}`,
                    })),
                },
            });
        });
    }
    return {
        ...fixture,
        reads,
        fail(query: string) {
            failures.add(query);
        },
        holdQuery(query: string) {
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
