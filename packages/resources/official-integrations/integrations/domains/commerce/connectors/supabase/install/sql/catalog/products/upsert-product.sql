

create or replace function commerce.upsert_product(
    p_product_id bigint,
    p_payload jsonb,
    p_expected_version integer default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_product commerce.products%rowtype;
    v_metadata jsonb;
    v_metadata_patch jsonb;
    v_primary_category_id bigint;
    v_axis_field_keys jsonb;
    v_settings commerce.settings%rowtype;
    v_session_id uuid := nullif(p_payload->>'uploadSessionId', '')::uuid;
    v_owner_id text := nullif(p_payload->>'internalCmsUserId', '');
    v_token uuid := nullif(p_payload->>'creationToken', '')::uuid;
    v_receipt commerce.product_creation_receipts%rowtype;
    v_hash text := md5((p_payload - 'internalCmsUserId')::text);
begin
    if p_product_id is null and v_token is not null then
        if v_owner_id is null then raise exception 'validation: creation owner is required'; end if;
        perform pg_advisory_xact_lock(hashtextextended(v_owner_id || ':' || v_token, 0));
        select * into v_receipt from commerce.product_creation_receipts where owner_id = v_owner_id and token = v_token;
        if found then
            if v_receipt.payload_hash <> v_hash then raise exception 'conflict: creation token was already used with different values'; end if;
            select * into v_product from commerce.products where id = v_receipt.product_id;
            return to_jsonb(v_product);
        end if;
    end if;
    if v_session_id is not null then perform commerce.lock_media_upload_session('product', v_session_id, v_owner_id); end if;
    select * into v_settings from commerce.settings where id = 'default' for share;
    if p_payload ? 'variantAxes' then
        select coalesce(jsonb_agg(axis->>'fieldKey'), '[]'::jsonb) into v_axis_field_keys
        from jsonb_array_elements(coalesce(p_payload->'variantAxes', '[]'::jsonb)) axis
        where nullif(axis->>'fieldKey', '') is not null;
    end if;
    if p_product_id is null then
        v_primary_category_id := nullif(p_payload->>'primaryCategoryId', '')::bigint;
        v_metadata := coalesce(p_payload->'metadata', '{}'::jsonb);
        if p_payload ? 'metadata' or v_primary_category_id is not null or p_payload->>'status' = 'active' then
            perform commerce.assert_product_custom_fields_with_axes(
                v_primary_category_id, v_metadata, 'admin', coalesce(v_axis_field_keys, '[]'::jsonb)
            );
        end if;
        insert into commerce.products (slug, title, description, brand_id, status, visibility, metadata)
        values (
            lower(btrim(p_payload->>'slug')),
            btrim(p_payload->>'title'),
            nullif(btrim(p_payload->>'description'), ''),
            nullif(p_payload->>'brandId', '')::bigint,
            coalesce(nullif(p_payload->>'status', ''), 'draft'),
            coalesce(nullif(p_payload->>'visibility', ''), 'hidden'),
            v_metadata
        ) returning * into v_product;
        if v_primary_category_id is not null then
            insert into commerce.product_categories (product_id, category_id, is_primary)
            values (v_product.id, v_primary_category_id, true);
        end if;
        if p_payload ? 'variantAxes' then
            perform commerce.sync_product_variant_matrix(
                v_product.id, p_payload->'variantAxes', p_payload->'variantMatrix'
            );
        end if;
    else
        if p_expected_version is null then raise exception 'validation: expected product version is required'; end if;
        select * into v_product from commerce.products where id = p_product_id for update;
        if not found then raise exception 'not_found: product'; end if;
        if v_product.version is distinct from p_expected_version then
            raise exception 'conflict: stale product version';
        end if;
        p_payload := commerce.preserve_product_variant_identity(p_product_id, p_payload);
        select category_id into v_primary_category_id
        from commerce.product_categories where product_id = p_product_id and is_primary;
        if p_payload ? 'primaryCategoryId' then
            v_primary_category_id := nullif(p_payload->>'primaryCategoryId', '')::bigint;
        end if;
        if not (p_payload ? 'variantAxes') then
            select coalesce(jsonb_agg(field_key), '[]'::jsonb) into v_axis_field_keys
            from commerce.product_variant_axes
            where product_id = p_product_id and field_key is not null;
        end if;
        perform id from commerce.product_variants
        where product_id = v_product.id
        order by id
        for update;
        perform id from commerce.offers
        where product_id = v_product.id
        order by id
        for update;
        if p_payload ? 'metadata' then
            v_metadata_patch := p_payload->'metadata';
            v_metadata := commerce.apply_product_metadata_patch(v_product.metadata, v_metadata_patch);
        else
            v_metadata := v_product.metadata;
        end if;
        if p_payload ? 'variantAxes' then
            perform commerce.assert_product_variant_fields_editable(v_axis_field_keys);
        end if;
        v_metadata := commerce.adjust_product_metadata_for_selection(
            v_metadata, v_metadata_patch, v_primary_category_id, v_axis_field_keys
        );
        perform commerce.assert_product_custom_fields_with_axes(
            v_primary_category_id, commerce.product_metadata_for_validation(v_metadata, v_primary_category_id), 'system', coalesce(v_axis_field_keys, '[]'::jsonb)
        );
        if p_payload ? 'mediaIds' then
            perform commerce.save_product_media(v_product.id, p_payload->'mediaIds', v_session_id, v_owner_id);
        end if;
        if coalesce(nullif(p_payload->>'status', ''), v_product.status) = 'active'
            and coalesce(nullif(p_payload->>'visibility', ''), v_product.visibility) = 'public'
            and (
                select count(*) from commerce.product_media where product_id = v_product.id
            ) not between v_settings.product_image_min_count and v_settings.product_image_max_count then
            raise exception 'validation: an active public product must have between % and % images',
                v_settings.product_image_min_count,
                v_settings.product_image_max_count;
        end if;
        update commerce.products
        set slug = coalesce(nullif(lower(btrim(p_payload->>'slug')), ''), slug),
            title = coalesce(nullif(btrim(p_payload->>'title'), ''), title),
            description = case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'), '') else description end,
            brand_id = case when p_payload ? 'brandId' then nullif(p_payload->>'brandId', '')::bigint else brand_id end,
            status = coalesce(nullif(p_payload->>'status', ''), status),
            visibility = coalesce(nullif(p_payload->>'visibility', ''), visibility),
            metadata = v_metadata
        where id = p_product_id
        returning * into v_product;
        if p_payload ? 'primaryCategoryId' then
            delete from commerce.product_categories where product_id = v_product.id and is_primary;
            if v_primary_category_id is not null then
                insert into commerce.product_categories (product_id, category_id, is_primary)
                values (v_product.id, v_primary_category_id, true)
                on conflict (product_id, category_id) do update set is_primary = true;
            end if;
        end if;
        if p_payload ? 'variantAxes' then
            perform commerce.sync_product_variant_matrix(
                v_product.id, p_payload->'variantAxes', p_payload->'variantMatrix'
            );
        end if;
        if v_product.status <> 'active' or v_product.visibility <> 'public' then
            update commerce.offers
            set publication_status = 'paused'
            where product_id = v_product.id and publication_status = 'active';
        end if;
    end if;
    if p_product_id is null then
        if p_payload ? 'mediaIds' then
            perform commerce.save_product_media(v_product.id, p_payload->'mediaIds', v_session_id, v_owner_id);
        end if;
        if v_product.status = 'active' and v_product.visibility = 'public' and (
            select count(*) from commerce.product_media where product_id = v_product.id
        ) not between v_settings.product_image_min_count and v_settings.product_image_max_count then
            raise exception 'validation: an active public product must have between % and % images',
                v_settings.product_image_min_count, v_settings.product_image_max_count;
        end if;
        if v_token is not null then
            insert into commerce.product_creation_receipts(owner_id, token, payload_hash, product_id)
            values (v_owner_id, v_token, v_hash, v_product.id);
        end if;
    end if;
    return to_jsonb(v_product);
end;
$$;
