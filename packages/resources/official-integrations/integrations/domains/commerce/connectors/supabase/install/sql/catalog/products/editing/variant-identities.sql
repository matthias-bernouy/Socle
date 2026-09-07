-- Field-based forms omit technical axis/value keys. Recover them inside the product lock.
create or replace function commerce.preserve_product_variant_identity(p_product_id bigint, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_input jsonb;
    v_axes jsonb := '[]'::jsonb;
    v_axis jsonb;
    v_values jsonb;
    v_value jsonb;
    v_previous commerce.product_variant_axes%rowtype;
    v_previous_value commerce.product_variant_axis_values%rowtype;
    v_matrix jsonb := '[]'::jsonb;
    v_row jsonb;
    v_choices jsonb;
    v_choice jsonb;
    v_axis_match jsonb;
    v_value_match jsonb;
    v_variant commerce.product_variants%rowtype;
    v_previous_form jsonb;
    v_input_form jsonb;
    v_key text;
    v_title text;
begin
    if p_payload->>'variantAxesFromFields' is distinct from 'true' then return p_payload; end if;
    v_input := p_payload->'variantAxes';
    select coalesce(jsonb_agg(jsonb_build_object('identity', coalesce(axis.field_key, axis.key), 'values', (
        select jsonb_agg(value.label order by value.position, value.id)
        from commerce.product_variant_axis_values value where value.axis_id = axis.id
    )) order by axis.position, axis.id), '[]'::jsonb) into v_previous_form
    from commerce.product_variant_axes axis where axis.product_id = p_product_id;
    select coalesce(jsonb_agg(jsonb_build_object('identity', coalesce(axis->>'fieldKey', axis->>'key'), 'values', (
        select jsonb_agg(value->>'label' order by (value->>'position')::integer)
        from jsonb_array_elements(axis->'values') value
    )) order by (axis->>'position')::integer), '[]'::jsonb) into v_input_form
    from jsonb_array_elements(v_input) axis;
    if v_input_form = v_previous_form then
        return p_payload - array['variantAxes', 'variantMatrix', 'variantAxesFromFields'];
    end if;
    for v_axis in select value from jsonb_array_elements(v_input)
    loop
        select * into v_previous from commerce.product_variant_axes
        where product_id = p_product_id and (
            field_key = v_axis->>'fieldKey' or (v_axis->>'fieldKey' is null and key = v_axis->>'key')
        ) order by id limit 1;
        v_values := '[]'::jsonb;
        for v_value in select value from jsonb_array_elements(v_axis->'values')
        loop
            select * into v_previous_value from commerce.product_variant_axis_values
            where axis_id = v_previous.id and label = v_value->>'label' order by id limit 1;
            v_values := v_values || jsonb_build_array(v_value || jsonb_build_object(
                'inputKey', v_value->>'key', 'key', coalesce(v_previous_value.key, v_value->>'key')
            ));
        end loop;
        v_axes := v_axes || jsonb_build_array(v_axis || jsonb_build_object(
            'inputKey', v_axis->>'key', 'key', coalesce(v_previous.key, v_axis->>'key'),
            'label', coalesce(v_previous.label, (
                select label from commerce.custom_field_definitions
                where entity_type = 'product' and key = v_axis->>'fieldKey'
            ), v_axis->>'label'), 'values', v_values
        ));
    end loop;
    for v_row in select value from jsonb_array_elements(p_payload->'variantMatrix')
    loop
        v_choices := '[]'::jsonb;
        v_title := '';
        for v_choice in select value from jsonb_array_elements(v_row->'choices')
        loop
            select value into v_axis_match from jsonb_array_elements(v_axes)
            where value->>'inputKey' = v_choice->>'axisKey';
            select value into v_value_match from jsonb_array_elements(v_axis_match->'values')
            where value->>'inputKey' = v_choice->>'valueKey';
            v_title := v_title || case when v_title = '' then '' else ' / ' end
                || (v_axis_match->>'label') || ': ' || (v_value_match->>'label');
            v_choices := v_choices || jsonb_build_array(jsonb_build_object(
                'axisKey', v_axis_match->>'key', 'valueKey', v_value_match->>'key'
            ));
        end loop;
        select variant.* into v_variant from commerce.product_variants variant
        where variant.product_id = p_product_id and variant.combination_key is not null
          and (select count(*) from commerce.product_variant_selections where variant_id = variant.id)
              = jsonb_array_length(v_choices)
          and not exists (
              select 1 from jsonb_array_elements(v_choices) choice where not exists (
                  select 1 from commerce.product_variant_selections selection
                  join commerce.product_variant_axes axis on axis.id = selection.axis_id
                  join commerce.product_variant_axis_values value on value.id = selection.value_id
                  where selection.variant_id = variant.id and axis.key = choice->>'axisKey'
                    and value.key = choice->>'valueKey'
              )
          ) order by variant.id limit 1;
        select string_agg((choice->>'axisKey') || ':' || (choice->>'valueKey'), '|' order by position)
        into v_key from jsonb_array_elements(v_choices) with ordinality choices(choice, position);
        v_matrix := v_matrix || jsonb_build_array(v_row || jsonb_build_object(
            'key', coalesce(v_variant.combination_key, v_key),
            'title', coalesce(v_variant.title, v_title), 'choices', v_choices
        ));
    end loop;
    return (p_payload - 'variantAxesFromFields') || jsonb_build_object('variantAxes', v_axes, 'variantMatrix', v_matrix);
end;
$$;
