begin;
set local role service_role;
do $product_media_cleanup$
declare
    v_id bigint;
    v_session uuid := gen_random_uuid();
    v_media bigint;
    v_result jsonb;
begin
    v_id := (commerce.upsert_product(null, '{"slug":"cleanup-product","title":"Cleanup"}')->>'id')::bigint;
    v_media := (commerce.stage_product_media(v_session, 'admin-a', not exists(select 1 from commerce.product_upload_sessions where id=v_session), jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/pending.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'pending.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_product_media_upload(v_session, 'admin-a', v_media);
    update commerce.product_media_uploads set expires_at = now() - interval '1 second' where media_id = v_media;
    if commerce.claim_product_media_cleanup(null, 'admin-b')->'items' <> '[]'::jsonb then
        raise exception 'test: owner cleanup included another administrator';
    end if;
    v_result := commerce.claim_product_media_cleanup(null, 'admin-a');
    if jsonb_array_length(v_result->'items') <> 1 then raise exception 'test: expired media was not claimed'; end if;
    if commerce.get_product_media_download_context(v_media)->>'state' <> 'not_found' then
        raise exception 'test: cleanup still allowed preview';
    end if;
    if commerce.claim_product_media_cleanup(v_session, 'admin-a') <> v_result then
        raise exception 'test: cleanup claim was not retryable';
    end if;
    begin
        perform commerce.upsert_product(v_id, jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a', 'mediaIds', jsonb_build_array(v_media)), 1);
        raise exception 'test: cleanup media was attached';
    exception when others then
        if sqlerrm not like 'validation: product image is unavailable%' then raise; end if;
    end;
    perform commerce.finish_product_media_cleanup(v_session, 'admin-a', v_media);
    if exists (select 1 from commerce.product_media_uploads where media_id = v_media)
        or (select detached_at from commerce.media where id = v_media) is null then
        raise exception 'test: cleanup completion did not retain audit metadata';
    end if;
    if has_table_privilege('anon', 'commerce.product_media_uploads', 'select')
        or has_table_privilege('authenticated', 'commerce.product_media_uploads', 'insert')
        or has_function_privilege('authenticated', 'commerce.stage_product_media(uuid,text,boolean,jsonb)', 'execute') then
        raise exception 'test: pending media privileges are exposed';
    end if;
end;
$product_media_cleanup$;
rollback;
