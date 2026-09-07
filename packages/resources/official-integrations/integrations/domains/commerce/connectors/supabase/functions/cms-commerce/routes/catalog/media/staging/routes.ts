import { HttpError } from "../../../../core/errors.ts";
import { json } from "../../../../core/http.ts";
import { camelize, integer, isRecord, readJsonObject } from "../../../../core/records.ts";
import { rpc } from "../../../../core/rest.ts";
import { productMediaBucket } from "../constants.ts";
import { readCommerceImage } from "../request.ts";
import { uploadStorageImage } from "../storage.ts";
import { sessionId, signedPreview, uploadOwner } from "./session.ts";
import { cleanupProductImages } from "./cleanup.ts";

export async function stageProductImage(request: Request): Promise<Response> {
    const owner = uploadOwner(request);
    const previousSession = sessionId(new URL(request.url).searchParams.get("sessionId"));
    const uploadSession = previousSession ?? crypto.randomUUID();
    await cleanupProductImages(previousSession, owner);
    const image = await readCommerceImage(request);
    const storagePath = `upload-sessions/${uploadSession}/${crypto.randomUUID()}${image.extension}`;
    const result = await rpc("stage_product_media", {
        p_session_id: uploadSession,
        p_owner_id: owner,
        p_create_session: !previousSession,
        p_payload: {
            storageBucket: productMediaBucket,
            storagePath,
            mimeType: image.mimeType,
            fileSize: image.file.size,
            originalFilename: image.file.name || "image",
            width: image.width,
            height: image.height,
        },
    });
    if (!isRecord(result) || typeof result.media_id !== "number") {
        throw new HttpError(502, "stage_product_media returned an invalid response");
    }
    let previewUrl: string;
    try {
        await uploadStorageImage(productMediaBucket, storagePath, image.file);
        previewUrl = await signedPreview(request, productMediaBucket, storagePath);
        await rpc("complete_product_media_upload", {
            p_session_id: uploadSession,
            p_owner_id: owner,
            p_media_id: result.media_id,
        });
    } catch (error) {
        try {
            await cleanupProductImages(uploadSession, owner, [result.media_id]);
        } catch {
            // The persisted cleanup claim remains retryable; never delete an unclaimed original.
        }
        throw error;
    }
    const media = camelize(result) as Record<string, unknown>;
    return json({
        sessionId: uploadSession,
        media: {
            ...media,
            id: result.media_id,
            name: image.file.name,
            previewUrl,
        },
    });
}

export async function discardStagedProductImages(request: Request): Promise<Response> {
    const body = await readJsonObject(request);
    const owner = uploadOwner(request);
    const uploadSession = sessionId(body.sessionId);
    if (!uploadSession) {
        throw new HttpError(400, "sessionId is required");
    }
    if (!Array.isArray(body.mediaIds) || body.mediaIds.length > 100) {
        throw new HttpError(422, "mediaIds must be an array of at most 100 ids");
    }
    const mediaIds = body.mediaIds.map((value) => integer(value, "mediaIds", true)!);
    await cleanupProductImages(uploadSession, owner, mediaIds);
    return json({ ok: true });
}
