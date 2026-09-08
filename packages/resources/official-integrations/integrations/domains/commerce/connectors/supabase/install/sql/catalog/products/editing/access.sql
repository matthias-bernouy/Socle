revoke all on commerce.product_creation_receipts from public, anon, authenticated;
grant select, insert, update, delete on commerce.product_creation_receipts to service_role;

revoke execute on function commerce.save_product_media(bigint, jsonb, uuid, text),
    commerce.apply_product_metadata_patch(jsonb, jsonb),
    commerce.preserve_product_variant_identity(bigint, jsonb),
    commerce.product_metadata_schema_keys(bigint),
    commerce.assert_product_variant_fields_editable(jsonb),
    commerce.adjust_product_metadata_for_selection(jsonb, jsonb, bigint, jsonb),
    commerce.product_metadata_for_validation(jsonb, bigint)
from public, anon, authenticated;
grant execute on function commerce.save_product_media(bigint, jsonb, uuid, text),
    commerce.apply_product_metadata_patch(jsonb, jsonb),
    commerce.preserve_product_variant_identity(bigint, jsonb),
    commerce.product_metadata_schema_keys(bigint),
    commerce.assert_product_variant_fields_editable(jsonb),
    commerce.adjust_product_metadata_for_selection(jsonb, jsonb, bigint, jsonb),
    commerce.product_metadata_for_validation(jsonb, bigint)
to service_role;
