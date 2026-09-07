import { cmsUserId, requireCmsAdmin } from "../../../../core/auth.ts";
import { HttpError } from "../../../../core/errors.ts";
import { requiredEnv, serviceRoleKey } from "../../../../core/env.ts";
import { isRecord } from "../../../../core/records.ts";

export function uploadOwner(request: Request): string {
    requireCmsAdmin(request);
    return cmsUserId(request);
}

export function sessionId(value: unknown): string | null {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    if (
        typeof value !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ) {
        throw new HttpError(400, "session or creation token must be a UUID");
    }
    return value;
}

export async function signedPreview(request: Request, bucket: string, path: string): Promise<string> {
    const key = serviceRoleKey();
    const headers = new Headers({ apikey: key, "content-type": "application/json" });
    if (!key.startsWith("sb_")) {
        headers.set("authorization", `Bearer ${key}`);
    }
    const objectPath = `${encodeURIComponent(bucket)}/${path.split("/").map(encodeURIComponent).join("/")}`;
    const response = await fetch(`${requiredEnv("SUPABASE_URL")}/storage/v1/object/sign/${objectPath}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ expiresIn: 3600 }),
    });
    const body: unknown = await response.json();
    if (!response.ok || !isRecord(body) || typeof body.signedURL !== "string") {
        throw new HttpError(502, "Storage preview signing failed");
    }
    // The configured public Functions URL also identifies the public Storage origin.
    const publicBase = request.headers.get("x-cms-functions-base-url") ?? requiredEnv("SUPABASE_URL");
    return new URL(`/storage/v1${body.signedURL}`, publicBase).href;
}
