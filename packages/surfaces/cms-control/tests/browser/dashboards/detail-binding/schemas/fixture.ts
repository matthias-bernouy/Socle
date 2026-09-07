import type { Page } from "playwright";
import { installReadonlyRoutes } from "../fixture";

export const schemaPage = "http://cms.test/admin/sources?source=store&dashboard=summary";
export const definitions = [
    { fieldKey: "weight", label: "Weight", fieldType: "number", required: true, unit: "g" },
    { fieldKey: "serial", label: "Serial", fieldType: "string" },
    { fieldKey: "condition", label: "Condition", fieldType: "enum", options: ["New", "Used"], required: true },
    { fieldKey: "refurbished", label: "Refurbished", fieldType: "boolean", required: true },
    { fieldKey: "optionalText", label: "Optional text", fieldType: "string" },
    { fieldKey: "optionalFlag", label: "Optional flag", fieldType: "boolean" },
    { fieldKey: "grip", definition: { label: "Grip", fieldType: "enum", options: ["L1", "L2"] } },
    { fieldKey: "excluded", label: "Excluded field", fieldType: "enum", options: ["grip", "none"] },
    { fieldKey: "constructor", label: "Unsafe", fieldType: "string" },
];

export async function installSchemaRoutes(page: Page, bundle: string, styles: string, conditional = false) {
    const resource = {
        title: "Category metadata",
        category: "tennis",
        showSchema: true,
        metadata: {
            excluded: "grip",
            weight: 300,
            serial: "Original serial",
            grip: "L1",
            optionalText: null,
            legacy: "preserved",
        },
        notes: "Saved notes",
    };
    const fixture = await installReadonlyRoutes(page, bundle, styles, {
        resource,
        normalize: (value) => Object.assign(resource, value),
        fields: [
            ...(conditional
                ? [{ id: "showSchema", path: "showSchema", label: "Show schema", type: "checkbox" as const }]
                : []),
            { id: "title", path: "title", label: "Title", type: "text" },
            {
                id: "category",
                path: "category",
                label: "Category",
                type: "select",
                options: ["tennis", "padel", "empty", ""].map((value) => ({ value, label: value || "None" })),
            },
            {
                id: "metadata",
                path: "metadata",
                label: "Metadata",
                type: "schema",
                ...(conditional ? { visibleWhen: { value: "$field.showSchema" as const, equals: true } } : {}),
                schema: { endpoint: "categoryFields", params: { category: "$field.category" }, itemsPath: "fields" },
                exclude: { from: "$field.metadata", valuePath: "excluded" },
            },
            { id: "notes", path: "notes", label: "Notes", type: "textarea" },
        ],
        extraEndpoints: [{ endpointId: "categoryFields", method: "GET", params: [] }],
    });
    const requests: Array<{ category: string; started: number; finished?: number }> = [];
    const pending = new Map<string, Promise<void>>();
    let failed = false;
    await page.route("**/.cms/sources/store/categoryFields*", async (route) => {
        const category = new URL(route.request().url()).searchParams.get("category") ?? "";
        const request: (typeof requests)[number] = { category, started: performance.now() };
        requests.push(request);
        await pending.get(category);
        const status = failed ? 503 : 200;
        failed = false;
        await route.fulfill({
            status,
            json:
                status === 503
                    ? { error: "Schema unavailable" }
                    : {
                          status: "available",
                          fields:
                              category === "empty"
                                  ? []
                                  : category === "padel"
                                    ? [{ id: "length", label: "Length", type: "number", unit: "cm" }]
                                    : definitions,
                      },
        });
        request.finished = performance.now();
    });
    return {
        ...fixture,
        resource,
        schemas: requests,
        failSchema() {
            failed = true;
        },
        holdSchema(category = "tennis") {
            let release = () => {};
            pending.set(
                category,
                new Promise<void>((resolve) => {
                    release = resolve;
                }),
            );
            return release;
        },
    };
}
