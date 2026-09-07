-- Form submission is a patch: hidden/read-only metadata remains owned by the server.
create or replace function commerce.apply_product_metadata_patch(p_previous jsonb, p_patch jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_values jsonb;
    v_deleted text[];
begin
    if jsonb_typeof(p_patch) is distinct from 'object' then
        raise exception 'validation: product metadata must be an object';
    end if;
    if pg_column_size(p_patch) > 65536 then raise exception 'validation: custom fields exceed 64 KiB'; end if;
    perform pg_advisory_xact_lock_shared(hashtextextended('commerce-custom-fields:product', 0));
    if exists (select 1 from jsonb_object_keys(p_patch) candidate(key) where not exists (
        select 1 from commerce.custom_field_definitions
        where entity_type = 'product' and custom_field_definitions.key = candidate.key
          and enabled and admin_editable
    )) then raise exception 'forbidden: product metadata contains a field that is not admin editable'; end if;
    select coalesce(jsonb_object_agg(key, value) filter (where value <> 'null'::jsonb), '{}'::jsonb),
        coalesce(array_agg(key) filter (where value = 'null'::jsonb), '{}'::text[])
    into v_values, v_deleted from jsonb_each(p_patch);
    perform commerce.assert_custom_field_patch('product', v_values, 'admin');
    return (coalesce(p_previous, '{}'::jsonb) - v_deleted) || v_values;
end;
$$;
