begin;
set local role service_role;
do $form_classification$
declare
    v_a bigint;
    v_b bigint;
    v_product bigint;
    v_saved jsonb;
begin
    insert into commerce.custom_field_definitions(entity_type,key,label,field_type,admin_editable,enabled)
    values('product','formOld','Old','string',true,true),('product','formNew','New','string',true,true),
        ('product','formHidden','Hidden','string',false,true),('product','formDisabled','Disabled','string',true,false);
    v_a := (commerce.upsert_category(null,'{"slug":"form-category-a","label":"A"}')->>'id')::bigint;
    v_b := (commerce.upsert_category(null,'{"slug":"form-category-b","label":"B"}')->>'id')::bigint;
    perform commerce.upsert_category_custom_field(v_a,'formOld');
    perform commerce.upsert_category_custom_field(v_b,'formNew');
    v_product := (commerce.upsert_product(null,jsonb_build_object(
        'slug','form-category-product','title','Category','primaryCategoryId',v_a,'metadata','{"formOld":"Old"}'::jsonb
    ))->>'id')::bigint;
    update commerce.products set metadata=metadata || '{"formHidden":"Keep private","formDisabled":"Keep disabled"}'::jsonb where id=v_product;
    v_saved := commerce.upsert_product(v_product,jsonb_build_object(
        'primaryCategoryId',v_b,'metadata','{"formNew":"New"}'::jsonb
    ),2);
    if v_saved->'metadata' <> '{"formNew":"New","formHidden":"Keep private","formDisabled":"Keep disabled"}'::jsonb then
        raise exception 'test: category change lost hidden data or kept obsolete editable data';
    end if;
    v_saved := commerce.upsert_product(v_product,'{"variantAxesFromFields":true,"metadata":{},
        "variantAxes":[{"key":"formnew","fieldKey":"formNew","label":"New","position":0,
            "values":[{"key":"new","label":"New","value":"New","position":0}]}],
        "variantMatrix":[{"key":"formnew:new","title":"New","choices":[{"axisKey":"formnew","valueKey":"new"}]}]}'::jsonb,3);
    if v_saved->'metadata' <> '{"formHidden":"Keep private","formDisabled":"Keep disabled"}'::jsonb then
        raise exception 'test: moving an editable scalar to a variant axis lost hidden data';
    end if;
end;
$form_classification$;
rollback;
