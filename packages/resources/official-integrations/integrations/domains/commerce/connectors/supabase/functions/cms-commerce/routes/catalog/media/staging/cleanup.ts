import { HttpError } from "../../../../core/errors.ts";
import { isRecord } from "../../../../core/records.ts";
import { rpc } from "../../../../core/rest.ts";
import { productMediaBucket } from "../constants.ts";
import { deleteStorageImage } from "../storage.ts";

export async function cleanupProductImages(
    sessionId: string | null,
    ownerId: string,
    mediaIds: number[] | null = null,
): Promise<void> {
    const result = await rpc("claim_product_media_cleanup", {
        p_session_id: sessionId,
        p_owner_id: ownerId,
        p_media_ids: mediaIds,
    });
    if (!isRecord(result) || !Array.isArray(result.items)) {
        throw new HttpError(502, "product image cleanup returned an invalid response");
    }
    for (const item of result.items) {
        if (
            !isRecord(item) ||
            typeof item.sessionId !== "string" ||
            (sessionId !== null && item.sessionId !== sessionId) ||
            item.storageBucket !== productMediaBucket ||
            typeof item.storagePath !== "string" ||
            !item.storagePath.startsWith(`upload-sessions/${item.sessionId}/`) ||
            !Number.isSafeInteger(item.mediaId)
        ) {
            throw new HttpError(502, "product image cleanup returned an invalid location");
        }
        await deleteStorageImage(productMediaBucket, item.storagePath);
        await rpc("finish_product_media_cleanup", {
            p_session_id: item.sessionId,
            p_owner_id: ownerId,
            p_media_id: item.mediaId,
        });
    }
}
