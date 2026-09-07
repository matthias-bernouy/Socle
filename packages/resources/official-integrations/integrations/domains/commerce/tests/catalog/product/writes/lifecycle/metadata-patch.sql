begin;
set local role service_role;
do $product_metadata_patch$
declare
    v_id bigint;
    v_result jsonb;
begin
    insert into commerce.custom_field_definitions(entity_type, key, label, field_type, admin_editable)
    values ('product', 'formWeight', 'Weight', 'number', true),
        ('product', 'formFlag', 'Flag', 'boolean', true),
        ('product', 'formNote', 'Note', 'string', true),
        ('product', 'formPrivate', 'Private', 'number', false);
    v_id := (commerce.upsert_product(null, '{"slug":"metadata-form","title":"Metadata"}')->>'id')::bigint;
    update commerce.products set metadata = '{"formWeight":200,"formNote":"Keep","formPrivate":73}' where id = v_id;
    v_result := commerce.upsert_product(v_id, '{"metadata":{"formWeight":0,"formFlag":false,"formNote":null}}', 2);
    if v_result->'metadata' <> '{"formWeight":0,"formFlag":false,"formPrivate":73}'::jsonb then
        raise exception 'test: omitted private data, zero, false or explicit removal changed: %', v_result;
    end if;
    begin
        perform commerce.upsert_product(v_id, '{"metadata":{"formPrivate":null}}', 3);
        raise exception 'test: private metadata was removed';
    exception when others then
        if sqlerrm not like 'forbidden: product metadata%' then raise; end if;
    end;
    begin
        perform commerce.upsert_product(v_id, '{"metadata":{"unknown":null}}', 3);
        raise exception 'test: unknown metadata accepted';
    exception when others then
        if sqlerrm not like 'forbidden: product metadata%' then raise; end if;
    end;
end;
$product_metadata_patch$;
rollback;
