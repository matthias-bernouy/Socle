begin;
set local role service_role;
do $product_form_media$
declare
    v_product jsonb;
    v_id bigint;
    v_session uuid := gen_random_uuid();
    v_other bigint;
    v_one bigint;
    v_two bigint;
    v_version integer;
    v_result jsonb;
begin
    v_product := commerce.upsert_product(null, '{"slug":"staged-product","title":"Staged product"}');
    v_id := (v_product->>'id')::bigint;
    if v_product->>'status' <> 'draft' or v_product->>'visibility' <> 'hidden' then
        raise exception 'test: minimal product must be a hidden draft';
    end if;
    v_other := (commerce.upsert_product(null, '{"slug":"staged-other","title":"Other"}')->>'id')::bigint;
    v_one := (commerce.stage_product_media(v_session, 'admin-a', not exists(select 1 from commerce.product_upload_sessions where id=v_session), jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/one.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'one.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    begin
        perform commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a', 'mediaIds', jsonb_build_array(v_one)), 1);
        raise exception 'test: upload in progress was attached';
    exception when others then
        if sqlerrm not like 'validation: product image is unavailable%' then raise; end if;
    end;
    perform commerce.complete_product_media_upload(v_session, 'admin-a', v_one);
    if exists (select 1 from commerce.product_media where product_id = v_id)
        or (select version from commerce.products where id = v_id) <> 1 then
        raise exception 'test: staging changed the product';
    end if;
    if commerce.get_product_media_download_context(v_one, v_session, 'admin-a')->>'state' <> 'ok' then
        raise exception 'test: ready staged media cannot be previewed';
    end if;
    begin
        perform commerce.upsert_product(v_other, jsonb_build_object('mediaIds', jsonb_build_array(v_one)), 1);
        raise exception 'test: cross-product stage was attached';
    exception when others then
        if sqlerrm not like 'validation: product image is unavailable%' then raise; end if;
    end;
    v_two := (commerce.stage_product_media(v_session, 'admin-a', not exists(select 1 from commerce.product_upload_sessions where id=v_session), jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/two.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'two.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_product_media_upload(v_session, 'admin-a', v_two);
    begin
        perform commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a',
            'title', 'Invalid', 'status', 'invalid', 'mediaIds', jsonb_build_array(v_two, v_one)
        ), 1);
        raise exception 'test: invalid product was saved';
    exception when check_violation then null;
    end;
    if exists (select 1 from commerce.product_media where product_id = v_id)
        or (select count(*) from commerce.product_media_uploads where session_id = v_session) <> 2 then
        raise exception 'test: failed save partially committed media';
    end if;
    v_result := commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a',
        'title', 'Saved', 'mediaIds', jsonb_build_array(v_two, v_one)
    ), 1);
    v_version := (v_result->>'version')::integer;
    if (select media_id from commerce.product_media where product_id = v_id and is_main) <> v_two
        or exists (select 1 from commerce.product_media_uploads where session_id = v_session) then
        raise exception 'test: save did not attach images in the requested order';
    end if;
    begin
        perform commerce.claim_product_media_cleanup(v_session, 'admin-a', jsonb_build_array(v_one));
        raise exception 'test: saved media was discarded';
    exception when others then
        if sqlerrm not like 'conflict: only pending product images%' then raise; end if;
    end;
    begin
        perform commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a', 'mediaIds', '[]'::jsonb), 1);
        raise exception 'test: stale save removed images';
    exception when others then
        if sqlerrm not like 'conflict: stale product version%' then raise; end if;
    end;
    perform commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a', 'mediaIds', jsonb_build_array(v_one)), v_version);
    if (select media_id from commerce.product_media where product_id = v_id and is_main) <> v_one
        or (select detached_at from commerce.media where id = v_two) is null then
        raise exception 'test: removal did not retain and detach the original';
    end if;
end;
$product_form_media$;
rollback;
