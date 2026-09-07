begin;
set local role service_role;
do $form_variant_identities$
declare
    v_category bigint;
    v_product bigint;
    v_before jsonb;
    v_after jsonb;
    v_small bigint;
    v_large bigint;
    v_payload jsonb;
begin
    insert into commerce.custom_field_definitions(entity_type,key,label,field_type)
    values('product','formSize','Size','string');
    v_category := (commerce.upsert_category(null,'{"slug":"form-size","label":"Form size"}')->>'id')::bigint;
    perform commerce.upsert_category_custom_field(v_category,'formSize');
    v_product := (commerce.upsert_product(null,jsonb_build_object(
        'slug','form-identity','title','Identity','primaryCategoryId',v_category,
        'variantAxes','[{"key":"legacy-size","fieldKey":"formSize","label":"Size","position":0,"values":[
            {"key":"legacy-small","label":"Small","value":"Small","position":0},
            {"key":"legacy-large","label":"Large","value":"Large","position":1}]}]'::jsonb,
        'variantMatrix','[
            {"key":"custom-small","title":"Custom small","choices":[{"axisKey":"legacy-size","valueKey":"legacy-small"}]},
            {"key":"custom-large","title":"Custom large","choices":[{"axisKey":"legacy-size","valueKey":"legacy-large"}]}]'::jsonb
    ))->>'id')::bigint;
    select jsonb_agg(to_jsonb(variant) order by id) into v_before from commerce.product_variants variant where product_id=v_product;
    select id into v_small from commerce.product_variants where product_id=v_product and combination_key='custom-small';
    select id into v_large from commerce.product_variants where product_id=v_product and combination_key='custom-large';
    v_payload := '{"variantAxesFromFields":true,"variantAxes":[{"key":"formsize","fieldKey":"formSize","label":"formSize","position":0,"values":[
        {"key":"small","label":"Small","value":"Small","position":0},
        {"key":"large","label":"Large","value":"Large","position":1}]}],
        "variantMatrix":[
            {"key":"formsize:small","title":"formSize: Small","choices":[{"axisKey":"formsize","valueKey":"small"}]},
            {"key":"formsize:large","title":"formSize: Large","choices":[{"axisKey":"formsize","valueKey":"large"}]}]}'::jsonb;
    perform commerce.upsert_product(v_product,v_payload,1);
    select jsonb_agg(to_jsonb(variant) order by id) into v_after from commerce.product_variants variant where product_id=v_product;
    if v_before <> v_after then raise exception 'test: unchanged form axes rewrote existing variants'; end if;
    v_payload := jsonb_set(v_payload,'{variantAxes,0,values}',v_payload#>'{variantAxes,0,values}' ||
        '[{"key":"medium","label":"Medium","value":"Medium","position":2}]'::jsonb);
    v_payload := jsonb_set(v_payload,'{variantMatrix}',v_payload->'variantMatrix' ||
        '[{"key":"formsize:medium","title":"formSize: Medium","choices":[{"axisKey":"formsize","valueKey":"medium"}]}]'::jsonb);
    perform commerce.upsert_product(v_product,v_payload,2);
    if not exists(select 1 from commerce.product_variants where id=v_small and combination_key='custom-small' and title='Custom small' and status='active')
        or not exists(select 1 from commerce.product_variants where id=v_large and combination_key='custom-large' and title='Custom large' and status='active')
        or not exists(select 1 from commerce.product_variants where product_id=v_product and combination_key='legacy-size:medium') then
        raise exception 'test: form axis change lost existing identities or failed to add the new combination';
    end if;
end;
$form_variant_identities$;
rollback;

begin;
set local role service_role;
do $free_axis_identity$
declare
    v_product bigint;
    v_original bigint;
begin
    v_product := (commerce.upsert_product(null, '{"slug":"free-axis-identity","title":"Free axis",
        "variantAxes":[{"key":"free-axis","label":"Legacy label","position":0,
            "values":[{"key":"legacy-value","label":"Old","value":"Old","position":0}]}],
        "variantMatrix":[{"key":"free-combination","title":"Original title",
            "choices":[{"axisKey":"free-axis","valueKey":"legacy-value"}]}]}'::jsonb)->>'id')::bigint;
    select id into v_original from commerce.product_variants where product_id=v_product;
    perform commerce.upsert_product(v_product,'{"variantAxesFromFields":true,
        "variantAxes":[{"key":"free-axis","label":"free-axis","position":0,"values":[
            {"key":"old","label":"Old","value":"Old","position":0},
            {"key":"extra","label":"Extra","value":"Extra","position":1}]}],
        "variantMatrix":[
            {"key":"free-axis:old","title":"free-axis: Old","choices":[{"axisKey":"free-axis","valueKey":"old"}]},
            {"key":"free-axis:extra","title":"free-axis: Extra","choices":[{"axisKey":"free-axis","valueKey":"extra"}]}]}'::jsonb,1);
    if not exists(select 1 from commerce.product_variants where id=v_original and title='Original title' and status='active')
        or not exists(select 1 from commerce.product_variants where product_id=v_product and title='Legacy label: Extra')
        or not exists(select 1 from commerce.product_variant_axes where product_id=v_product and label='Legacy label') then
        raise exception 'test: hidden technical axis key did not preserve the free axis label and variants';
    end if;
end;
$free_axis_identity$;
rollback;
