revoke all on commerce.product_media_uploads, commerce.product_upload_sessions, commerce.product_creation_receipts from public, anon, authenticated;
grant select, insert, update, delete on commerce.product_media_uploads, commerce.product_upload_sessions, commerce.product_creation_receipts to service_role;

revoke execute on function commerce.lock_product_upload_session(uuid, text, boolean),
    commerce.stage_product_media(uuid, text, boolean, jsonb),
    commerce.complete_product_media_upload(uuid, text, bigint),
    commerce.save_product_media(bigint, jsonb, uuid, text),
    commerce.claim_product_media_cleanup(uuid, text, jsonb),
    commerce.finish_product_media_cleanup(uuid, text, bigint),
    commerce.apply_product_metadata_patch(jsonb, jsonb),
    commerce.preserve_product_variant_identity(bigint, jsonb),
    commerce.product_metadata_schema_keys(bigint),
    commerce.assert_product_variant_fields_editable(jsonb),
    commerce.adjust_product_metadata_for_selection(jsonb, jsonb, bigint, jsonb),
    commerce.product_metadata_for_validation(jsonb, bigint)
from public, anon, authenticated;
grant execute on function commerce.lock_product_upload_session(uuid, text, boolean),
    commerce.stage_product_media(uuid, text, boolean, jsonb),
    commerce.complete_product_media_upload(uuid, text, bigint),
    commerce.save_product_media(bigint, jsonb, uuid, text),
    commerce.claim_product_media_cleanup(uuid, text, jsonb),
    commerce.finish_product_media_cleanup(uuid, text, bigint),
    commerce.apply_product_metadata_patch(jsonb, jsonb),
    commerce.preserve_product_variant_identity(bigint, jsonb),
    commerce.product_metadata_schema_keys(bigint),
    commerce.assert_product_variant_fields_editable(jsonb),
    commerce.adjust_product_metadata_for_selection(jsonb, jsonb, bigint, jsonb),
    commerce.product_metadata_for_validation(jsonb, bigint)
to service_role;
