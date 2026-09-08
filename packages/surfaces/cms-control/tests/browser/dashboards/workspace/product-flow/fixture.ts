import { resolve, dirname } from "node:path";
import type { Page } from "playwright";

const workspace = resolve(import.meta.dir, "../../../../../../../..");
const root = `${workspace}/packages/resources/official-integrations/integrations/domains/commerce/definitions/artifacts/dashboards/products/views`;
async function declaration(path: string): Promise<any> {
    const data = await Bun.file(path).json();
    const visit = async (value: any): Promise<any> => {
        if (Array.isArray(value)) {
            return Promise.all(value.map(visit));
        }
        if (value && typeof value === "object") {
            if (value.$files) {
                return (
                    await Promise.all(value.$files.map((file: string) => declaration(resolve(dirname(path), file))))
                ).flat();
            }
            if (value.$include) {
                return declaration(resolve(dirname(path), value.$include));
            }
            return Object.fromEntries(
                await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await visit(item)])),
            );
        }
        return value;
    };
    return visit(data);
}
export async function productFixture(
    page: Page,
    options: { baseline?: string; actions?: any[]; navigation?: boolean | "detail"; titleVisibleWhen?: unknown } = {},
) {
    const detail = await declaration(`${root}/product-detail.json`);
    const tables = await declaration(`${root}/products-table.json`);
    const taxonomy = await declaration(resolve(root, "../../taxonomy/dashboard.json"));
    if (options.navigation) {
        tables[0] = {
            ...tables[0],
            widget: "w-navigation-list",
            item: { title: { path: "title" } },
        };
    }
    if (options.navigation === "detail") {
        detail.main.push(tables[0]);
    }
    if (options.actions) {
        detail.actions = options.actions;
    }
    if (options.titleVisibleWhen) {
        detail.main
            .flatMap((section: any) => section.fields ?? [])
            .find((field: any) => field.id === "title").visibleWhen = options.titleVisibleWhen;
    }
    if (options.baseline) {
        detail.actions = [
            {
                id: "saveProduct",
                label: "Save product",
                tone: "primary",
                placement: "primary",
                endpoint: { endpoint: "upsertProduct" },
            },
        ];
        delete detail.save;
        for (const section of detail.aside) {
            for (const field of section.fields) {
                if (field.lookup) {
                    delete field.lookup.create;
                    delete field.lookup.edit;
                }
            }
        }
    }
    const sourceId = "commerce";
    const state = {
        current: {
            id: 42,
            title: "Racket Pro",
            slug: "racket-pro",
            description: "Original description",
            brandId: 1,
            brand: { id: 1, name: "Original brand" },
            primaryCategoryId: 2,
            primaryCategory: { id: 2, label: "Tennis" },
            metadata: { weight: 300, approved: false },
            variantAxes: [],
            variantMatrix: [],
            media: [],
            status: "draft",
            visibility: "hidden",
            version: 7,
        } as Record<string, any>,
        reads: 0,
        productReads: [] as string[],
        brandReads: [] as string[],
        writes: [] as Record<string, any>[],
        creates: [] as Record<string, any>[],
        brands: [] as Record<string, any>[],
        brandRecords: new Map<number, Record<string, any>>([
            [
                1,
                {
                    id: 1,
                    name: "Original brand",
                    slug: "original-brand",
                    description: "Original brand description",
                    status: "active",
                    version: 1,
                },
            ],
        ]),
        saveDelay: 0,
        readDelay: 0,
        brandReadDelay: 0,
        brandSaveDelay: 0,
        saveStatus: 204,
        readStatus: 200,
        errors: [] as string[],
        requests: [] as string[],
    };
    const group = {
        source: {
            id: sourceId,
            urn: `urn:${sourceId}`,
            name: "Commerce",
            endpointCount: 17,
            dashboardCount: 2,
            readonly: false,
        },
        endpoints: [
            "manageProduct",
            "manageProducts",
            "manageBrands",
            "manageBrand",
            "manageCategory",
            "manageCategories",
            "categoryProductFields",
            "productImage",
        ]
            .map((endpointId) => ({ endpointId, method: "GET", params: [] }))
            .concat(
                [
                    "upsertProduct",
                    "upsertBrand",
                    "upsertCategory",
                    "reorderBrands",
                    "reorderCategories",
                    "stageProductImage",
                    "archiveProduct",
                    "reviewOffer",
                ].map((endpointId) => ({
                    endpointId,
                    method: "POST",
                    params: [],
                })),
                ["deleteBrand", "deleteCategory"].map((endpointId) => ({ endpointId, method: "DELETE", params: [] })),
            ),
        dashboards: [
            { id: "products", source: sourceId, meta: { name: "Products" }, views: [...tables, detail] },
            taxonomy,
        ],
    };
    const script = await Bun.file(
        options.baseline ?? `${workspace}/packages/surfaces/cms-control/src/static/assets/control-components.js`,
    ).text();
    const styles = await Bun.file(`${workspace}/packages/foundation/components/dist/style.css`).text();
    page.on("pageerror", (error) => state.errors.push(error.message));
    await page.route("http://cms.test/**", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        state.requests.push(path);
        if (path === "/control.js") {
            return route.fulfill({ contentType: "text/javascript", body: script });
        }
        if (request.resourceType() === "document") {
            return route.fulfill({
                contentType: "text/html",
                body: `<!doctype html><meta charset="utf-8"><meta name="basePath" content=""><style>${styles}</style><cms-binding-core><w13c-fixed-admin-layout><cms-dashboards-nav slot="secondary-lateral-nav"></cms-dashboards-nav><cms-dashboards-admin></cms-dashboards-admin></w13c-fixed-admin-layout></cms-binding-core><script src="/control.js"></script>`,
            });
        }
        if (path === "/api/dashboards") {
            return route.fulfill({ json: [group] });
        }
        if (path.endsWith("/manageProduct")) {
            state.reads++;
            state.productReads.push(url.search);
            if (url.searchParams.has("id") && Number(url.searchParams.get("id")) !== state.current.id) {
                return route.fulfill({ status: 404, json: { error: "Product not found" } });
            }
            await delay(state.readDelay);
            return route.fulfill({
                status: state.readStatus,
                json:
                    state.readStatus === 200
                        ? url.searchParams.has("id")
                            ? state.current
                            : {
                                  id: null,
                                  version: null,
                                  title: "",
                                  slug: "",
                                  description: "",
                                  status: "draft",
                                  visibility: "hidden",
                                  brandId: null,
                                  brand: null,
                                  primaryCategoryId: null,
                                  primaryCategory: null,
                                  metadata: {},
                                  variantAxes: [],
                                  variantMatrix: [],
                                  media: [],
                                  creationToken: "c3dbb55b-3d6e-4b5f-9b8c-53690188984e",
                              }
                        : { error: "Read unavailable" },
            });
        }
        if (path.endsWith("/upsertProduct")) {
            const body = request.postDataJSON();
            if (!body.id) {
                state.creates.push(body);
                await delay(state.saveDelay);
                state.current = {
                    ...state.current,
                    ...body,
                    id: 43,
                    title: body.title,
                    slug: body.slug || "new-draft",
                    status: "draft",
                    visibility: "hidden",
                    version: 1,
                };
                delete state.current.creationToken;
                return route.fulfill({ json: state.current });
            }
            state.writes.push(body);
            await delay(state.saveDelay);
            if (state.saveStatus !== 204) {
                return route.fulfill({ status: state.saveStatus, json: { error: "Version conflict" } });
            }
            state.current = { ...state.current, ...body, title: body.title.trim(), version: state.current.version + 1 };
            state.current.brand = state.brandRecords.get(Number(state.current.brandId)) ?? null;
            return route.fulfill({ status: 204 });
        }
        if (path.endsWith("/manageBrand")) {
            state.brandReads.push(url.search);
            await delay(state.brandReadDelay);
            const id = Number(url.searchParams.get("id"));
            return route.fulfill({
                json: id
                    ? state.brandRecords.get(id)
                    : { id: null, version: null, name: "", slug: "", description: "", status: "active" },
            });
        }
        if (path.endsWith("/upsertBrand")) {
            const body = request.postDataJSON();
            state.brands.push(body);
            await delay(state.brandSaveDelay);
            const id = body.id ?? 9;
            const current = state.brandRecords.get(id);
            const saved = { ...current, ...body, id, version: (current?.version ?? 0) + 1 };
            state.brandRecords.set(id, saved);
            return body.id ? route.fulfill({ status: 204 }) : route.fulfill({ json: saved });
        }
        const results: Record<string, unknown> = {
            manageProducts: { items: [state.current], total: 1 },
            manageBrands: { items: [...state.brandRecords.values()], total: state.brandRecords.size },
            manageCategories: { items: [state.current.primaryCategory], total: 1 },
            categoryProductFields: {
                fields: [
                    { fieldKey: "weight", label: "Weight", fieldType: "number" },
                    { fieldKey: "approved", label: "Approved", fieldType: "boolean" },
                ],
            },
        };
        return route.fulfill({ json: results[path.split("/").at(-1)!] ?? [] });
    });
    return state;
}
export const detailUrl =
    "http://cms.test/admin/sources?source=commerce&dashboard=products&collection=productDetail&row=42";
export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
