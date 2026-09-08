revoke all on commerce.media_uploads, commerce.media_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on commerce.media_uploads, commerce.media_upload_sessions to service_role;

revoke execute on function commerce.lock_media_upload_session(text, uuid, text, boolean),
    commerce.stage_media(text, uuid, text, boolean, jsonb),
    commerce.complete_media_upload(text, uuid, text, bigint),
    commerce.claim_media_cleanup(text, uuid, text, jsonb),
    commerce.finish_media_cleanup(text, uuid, text, bigint)
from public, anon, authenticated;
grant execute on function commerce.lock_media_upload_session(text, uuid, text, boolean),
    commerce.stage_media(text, uuid, text, boolean, jsonb),
    commerce.complete_media_upload(text, uuid, text, bigint),
    commerce.claim_media_cleanup(text, uuid, text, jsonb),
    commerce.finish_media_cleanup(text, uuid, text, bigint)
to service_role;
