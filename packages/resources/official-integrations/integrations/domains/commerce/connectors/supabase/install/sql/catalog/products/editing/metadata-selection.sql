create or replace function commerce.product_metadata_schema_keys(p_category_id bigint)
returns text[] language sql stable set search_path = '' as $$
    with recursive ancestry as (
        select id, parent_id from commerce.categories where id = p_category_id
        union all
        select parent.id, parent.parent_id from commerce.categories parent
        join ancestry child on child.parent_id = parent.id
    )
    select coalesce(array_agg(definition.key), '{}'::text[])
    from commerce.custom_field_definitions definition
    where definition.entity_type = 'product' and definition.enabled
      and (p_category_id is null or exists (
          select 1 from commerce.category_custom_fields field
          join ancestry category on category.id = field.category_id
          where field.entity_type = 'product' and field.field_key = definition.key
      ));
$$;

-- An explicit category/axis selection retires incompatible editable scalar values.
-- Private or disabled fields stay stored, even when the form does not display them.
create or replace function commerce.adjust_product_metadata_for_selection(
    p_values jsonb, p_patch jsonb, p_category_id bigint, p_axis_keys jsonb
)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_allowed text[] := commerce.product_metadata_schema_keys(p_category_id);
    v_result jsonb;
begin
    if exists (
        select 1 from jsonb_each(coalesce(p_patch, '{}'::jsonb)) submitted
        where submitted.value <> 'null'::jsonb and not (submitted.key = any(v_allowed))
    ) then raise exception 'validation: submitted metadata is outside the selected category schema'; end if;
    if exists (
        select 1 from jsonb_each(coalesce(p_patch, '{}'::jsonb)) submitted
        where submitted.value <> 'null'::jsonb and coalesce(p_axis_keys, '[]'::jsonb) ? submitted.key
    ) then raise exception 'validation: variant axis metadata cannot also be stored on the Product'; end if;
    select coalesce(jsonb_object_agg(stored.key, stored.value), '{}'::jsonb) into v_result
    from jsonb_each(p_values) stored
    where not (coalesce(p_axis_keys, '[]'::jsonb) ? stored.key)
      and (stored.key = any(v_allowed) or not exists (
          select 1 from commerce.custom_field_definitions definition
          where definition.entity_type = 'product' and definition.key = stored.key
            and definition.enabled and definition.admin_editable
      ));
    return v_result;
end;
$$;

create or replace function commerce.product_metadata_for_validation(p_values jsonb, p_category_id bigint)
returns jsonb language sql stable set search_path = '' as $$
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(p_values) where key = any(commerce.product_metadata_schema_keys(p_category_id));
$$;

create or replace function commerce.assert_product_variant_fields_editable(p_axis_keys jsonb)
returns void language plpgsql set search_path = '' as $$
begin
    if exists (
        select 1 from jsonb_array_elements_text(coalesce(p_axis_keys, '[]'::jsonb)) selected(key)
        join commerce.custom_field_definitions definition
          on definition.entity_type = 'product' and definition.key = selected.key
        where not definition.admin_editable or not definition.enabled
    ) then raise exception 'forbidden: variant metadata is not admin editable'; end if;
end;
$$;
