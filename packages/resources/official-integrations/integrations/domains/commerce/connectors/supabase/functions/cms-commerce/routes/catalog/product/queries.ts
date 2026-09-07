import { sessionId, uploadOwner } from "../media/staging/session.ts";
import { HttpError } from "../../../core/errors.ts";
import { json } from "../../../core/http.ts";
import { camelize, integer, publicMetadata, readJsonObject, text } from "../../../core/records.ts";
import { listRows, restJson } from "../../../core/rest.ts";
import type { JsonRecord } from "../../../core/types.ts";
import { productData } from "./data.ts";
import { getProductReadModel, upsertProductReadModel } from "./read-model.ts";
import { withVariantMatrix } from "../variants/matrix.ts";

const productSelect = "id,slug,title,description,brand_id,status,visibility,metadata,version,created_at,updated_at";

export async function listProducts(request: Request, admin: boolean): Promise<Response> {
    const url = new URL(request.url);
    const params = paging(url);
    params.set("select", productSelect);
    params.set("order", "updated_at.desc,id.desc");
    if (!admin) {
        params.set("status", "eq.active");
        params.set("visibility", "eq.public");
    } else {
        addEq(params, "status", url.searchParams.get("status"));
        addEq(params, "visibility", url.searchParams.get("visibility"));
    }
    addSearch(params, url.searchParams.get("q"), ["title", "slug"]);
    const { rows, total } = await listRows(`products?${params.toString()}`);
    const items = admin ? rows : await redactMetadata(rows, "product");
    return json({
        items: camelize(items),
        total,
        limit: Number(params.get("limit")),
        offset: Number(params.get("offset")),
    });
}

export async function getProduct(request: Request, admin: boolean): Promise<Response> {
    const url = new URL(request.url);
    if (admin && !url.searchParams.get("id") && !url.searchParams.get("slug")) {
        const response = json(newProduct());
        response.headers.set("cache-control", "private, no-store");
        return response;
    }
    const selector = productSelector(url);
    const bundle = await getProductReadModel(admin ? "admin" : "public", selector.id, selector.slug);
    if (!bundle) {
        throw new HttpError(404, "product not found");
    }
    return json(productData(bundle, !admin));
}

export async function upsertProduct(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = withVariantMatrix(await readJsonObject(request));
    delete body.internalCmsUserId;
    if (body.uploadSessionId || body.creationToken) {
        body.internalCmsUserId = uploadOwner(request);
        if (body.uploadSessionId) {
            body.uploadSessionId = sessionId(body.uploadSessionId);
        }
        if (body.creationToken) {
            body.creationToken = sessionId(body.creationToken);
        }
    }
    const bodyId = body.id === undefined || body.id === null || body.id === "" ? null : integer(body.id, "id", true)!;
    const queryId = optionalId(url.searchParams.get("id"));
    if (bodyId !== null && queryId !== null && bodyId !== queryId) {
        throw new HttpError(400, "body.id and query id must identify the same product");
    }
    const productId = bodyId ?? queryId;
    if (productId === null) {
        const title = text(body.title);
        if (!title) {
            throw new HttpError(422, "title is required");
        }
        body.title = title;
        body.slug ||= `${
            title
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 110)
                .replace(/-+$/g, "") || "product"
        }-${body.creationToken ?? crypto.randomUUID()}`;
        body.status ??= "draft";
        body.visibility ??= "hidden";
    }
    const expectedVersion = integer(body.expectedVersion, "expectedVersion", productId !== null);
    const bundle = await upsertProductReadModel(productId, body, expectedVersion);
    return json(productData(bundle, false));
}

function productSelector(url: URL): { id: number | null; slug: string | null } {
    const id = optionalId(url.searchParams.get("id"));
    const slug = text(url.searchParams.get("slug")) ?? null;
    if (id === null && !slug) {
        throw new HttpError(400, "id or slug is required");
    }
    return { id, slug: id === null ? slug : null };
}

async function redactMetadata(rows: JsonRecord[], entityType: string): Promise<JsonRecord[]> {
    const definitions = await restJson<JsonRecord[]>(
        `custom_field_definitions?select=key&entity_type=eq.${entityType}&public_readable=eq.true&enabled=eq.true`,
    );
    const allowed = new Set(definitions.map((row) => String(row.key)));
    return rows.map((row) => ({ ...row, metadata: publicMetadata(row.metadata, allowed) }));
}

function newProduct(): JsonRecord {
    return {
        id: null,
        slug: "",
        title: "",
        description: "",
        brandId: null,
        primaryCategoryId: null,
        status: "draft",
        visibility: "hidden",
        metadata: {},
        media: [],
        mainImageMediaId: null,
        variantAxes: [],
        variants: [],
        variantMatrix: [],
        version: null,
        brand: null,
        primaryCategory: null,
        createdAt: null,
        updatedAt: null,
        creationToken: crypto.randomUUID(),
    };
}

function paging(url: URL): URLSearchParams {
    const limit = Math.min(Math.max(integer(url.searchParams.get("limit"), "limit") ?? 50, 1), 100);
    const offset = Math.max(integer(url.searchParams.get("offset"), "offset") ?? 0, 0);
    return new URLSearchParams({ limit: String(limit), offset: String(offset) });
}

function addEq(params: URLSearchParams, column: string, value: string | null): void {
    if (value?.trim()) {
        params.set(column, `eq.${value.trim()}`);
    }
}

function addSearch(params: URLSearchParams, value: string | null, columns: string[]): void {
    const query = value?.trim().replace(/[,*()]/g, " ");
    if (query) {
        params.set("or", `(${columns.map((column) => `${column}.ilike.*${query}*`).join(",")})`);
    }
}

function optionalId(value: string | null): number | null {
    if (!value) {
        return null;
    }
    return integer(value, "id", true)!;
}
