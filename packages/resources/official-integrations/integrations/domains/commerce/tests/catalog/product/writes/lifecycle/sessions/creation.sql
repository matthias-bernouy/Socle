begin;
update commerce.settings set product_image_min_count = 1 where id = 'default';
set local role service_role;
do $$
declare
    v_session uuid := gen_random_uuid();
    v_token uuid := gen_random_uuid();
    v_media bigint;
    v_product jsonb;
    v_payload jsonb;
    v_count bigint;
begin
    select count(*) into v_count from commerce.products;
    v_media := (commerce.stage_product_media(v_session, 'admin-a', true, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/new.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'new.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_product_media_upload(v_session, 'admin-a', v_media);
    if (select count(*) from commerce.products) <> v_count then raise exception 'test: upload created a product'; end if;
    if commerce.get_product_media_download_context(v_media)->>'state' <> 'not_found'
        or commerce.get_product_media_download_context(v_media, v_session, 'admin-b')->>'state' <> 'not_found'
        or commerce.get_product_media_download_context(v_media, v_session, 'admin-a')->>'state' <> 'ok' then
        raise exception 'test: preview ownership was not enforced';
    end if;
    begin
        perform commerce.claim_product_media_cleanup(v_session, 'admin-b', jsonb_build_array(v_media));
        raise exception 'test: another administrator could discard this session';
    exception when others then
        if sqlerrm <> 'not_found: upload session' then raise; end if;
    end;
    v_payload := jsonb_build_object('slug', 'session-creation', 'title', 'Session product', 'status', 'active',
        'visibility', 'public', 'mediaIds', jsonb_build_array(v_media), 'uploadSessionId', v_session,
        'internalCmsUserId', 'admin-a', 'creationToken', v_token);
    begin
        perform commerce.upsert_product(null, v_payload || '{"internalCmsUserId":"admin-b"}');
        raise exception 'test: another administrator adopted this session';
    exception when others then
        if sqlerrm <> 'not_found: upload session' then raise; end if;
    end;
    v_product := commerce.upsert_product(null, v_payload);
    if (select count(*) from commerce.products) <> v_count + 1
        or not exists(select 1 from commerce.product_media where product_id = (v_product->>'id')::bigint and media_id = v_media) then
        raise exception 'test: active creation did not atomically attach staged image';
    end if;
    if commerce.upsert_product(null, v_payload)->>'id' <> v_product->>'id'
        or (select count(*) from commerce.products) <> v_count + 1 then
        raise exception 'test: replay created a duplicate';
    end if;
    begin
        perform commerce.upsert_product(null, v_payload || '{"title":"Changed retry"}');
        raise exception 'test: reused token accepted different payload';
    exception when others then
        if sqlerrm not like 'conflict: creation token%' then raise; end if;
    end;
    -- The open form can upload again after Save, into the same owned session.
    perform commerce.stage_product_media(v_session, 'admin-a', false, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/later.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'later.png', 'width', 1, 'height', 1
    ));
    begin
        perform commerce.upsert_product(null, v_payload || jsonb_build_object('creationToken', gen_random_uuid(), 'slug', 'other-product'));
        raise exception 'test: session transferred to another product';
    exception when others then
        if sqlerrm <> 'conflict: upload session belongs to another product' then raise; end if;
    end;
    if (select count(*) from commerce.products) <> v_count + 1 then raise exception 'test: failure leaked product'; end if;
end;
$$;
rollback;
