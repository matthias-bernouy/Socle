import { requireCmsAdmin } from "../auth.ts";
import { boundedInteger, HttpError, json, queryText, requestBody } from "../http.ts";
import { rpcRecord } from "../rest.ts";
import { formDefinition } from "../validation.ts";
import { starterDefinition, requiredText, optionalText } from "../builder/model.ts";

export async function handleAdminRoute(route: string, request: Request): Promise<Response | null> {
    if (!route.startsWith("/admin/")) {
        return null;
    }
    const actor = requireCmsAdmin(request);
    const url = new URL(request.url);
    if (route === "/admin/forms") {
        requireMethod(request, "GET");
        return json(
            await rpcRecord("list_managed_forms", {
                p_query: queryText(url, "q"),
                p_status: queryText(url, "status"),
                p_limit: boundedInteger(url.searchParams.get("limit"), "limit", 50, 1, 100),
                p_offset: boundedInteger(url.searchParams.get("offset"), "offset", 0, 0, 1000000),
            }),
        );
    }
    if (route === "/admin/form") {
        requireMethod(request, "GET");
        if (!queryText(url, "key")) {
            return json(newForm());
        }
        const result = await rpcRecord("get_managed_form", { p_form_key: queryText(url, "key", true) });
        return json(result);
    }
    if (route === "/admin/form/draft") {
        requireMethod(request, "POST");
        return json(await saveDraft(request, actor));
    }
    if (route === "/admin/form/publish") {
        requireMethod(request, "POST");
        const key = String((await requestBody(request)).key ?? "");
        const managed = await rpcRecord("get_managed_form", { p_form_key: key });
        formDefinition(managed.draftDefinition);
        return json(await rpcRecord("publish_form", { p_form_key: key, p_actor_id: actor }));
    }
    if (route === "/admin/form/archive") {
        requireMethod(request, "POST");
        const key = String((await requestBody(request)).key ?? "");
        return json(await rpcRecord("archive_form", { p_form_key: key, p_actor_id: actor }));
    }
    return null;
}

async function saveDraft(request: Request, actor: string): Promise<Record<string, unknown>> {
    const body = await requestBody(request);
    if (Object.hasOwn(body, "definition")) {
        throw new HttpError(422, "form settings cannot replace the draft definition");
    }
    const id = body.id ?? null;
    if (id !== null && (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)) {
        throw new HttpError(422, "form id must be a positive integer");
    }
    const title = requiredText(body.title, "form title");
    if (!["public", "authenticated"].includes(String(body.accessMode))) {
        throw new HttpError(422, "visitor access is not supported");
    }
    return await rpcRecord("save_form_settings", {
        p_form_id: id,
        p_form_key: id === null ? requiredText(body.key, "form key", 120) : null,
        p_title: title,
        p_description: optionalText(body.description) ?? null,
        p_access_mode: body.accessMode,
        p_initial_definition: starterDefinition(title),
        p_actor_id: actor,
    });
}

function newForm(): Record<string, unknown> {
    return {
        id: null,
        key: "",
        title: "",
        description: "",
        accessMode: "public",
        status: "draft",
        version: null,
        draftDefinition: starterDefinition("Untitled form"),
        publishedAt: null,
        createdAt: null,
        updatedAt: null,
    };
}

function requireMethod(request: Request, method: string): void {
    if (request.method !== method) {
        throw new HttpError(405, `method must be ${method}`);
    }
}
