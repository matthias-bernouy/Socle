\set ON_ERROR_STOP on
begin;
set local role service_role;
do $offer_save$
declare
    v_session uuid := gen_random_uuid();
    v_token uuid := gen_random_uuid();
    v_product bigint;
    v_image bigint;
    v_other bigint;
    v_payload jsonb;
    v_offer jsonb;
    v_result jsonb;
    v_count bigint;
begin
    v_product := (commerce.upsert_product(null, '{"slug":"offer-staging-product","title":"Product"}')->>'id')::bigint;
    v_image := (commerce.stage_media('offer', v_session, 'admin-a', true, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/one.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'one.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    select count(*) into v_count from commerce.offers;
    v_payload := jsonb_build_object('productId', v_product, 'slug', 'staged-offer', 'title', 'Staged offer',
        'mediaIds', jsonb_build_array(v_image), 'uploadSessionId', v_session, 'creationToken', v_token,
        'internalCmsUserId', 'admin-a');
    begin
        perform commerce.upsert_offer(null, v_payload);
        raise exception 'test: incomplete transfer was attached';
    exception when others then
        if sqlerrm not like 'validation: offer image is unavailable%' then raise; end if;
    end;
    perform commerce.complete_media_upload('offer', v_session, 'admin-a', v_image);
    begin
        perform commerce.upsert_product(v_product, v_payload, 1);
        raise exception 'test: product adopted an offer upload session';
    exception when others then
        if sqlerrm <> 'not_found: upload session' then raise; end if;
    end;
    begin
        perform commerce.upsert_offer(null, v_payload || '{"internalCmsUserId":"admin-b"}');
        raise exception 'test: another administrator adopted a session';
    exception when others then
        if sqlerrm <> 'not_found: upload session' then raise; end if;
    end;
    begin
        perform commerce.claim_media_cleanup('product', v_session, 'admin-a', jsonb_build_array(v_image));
        raise exception 'test: product cleanup claimed offer media';
    exception when others then
        if sqlerrm <> 'not_found: upload session' then raise; end if;
    end;
    if (select count(*) from commerce.offers) <> v_count or exists (
        select 1 from commerce.offer_media where media_id = v_image
    ) then raise exception 'test: staging or failed creation persisted an offer'; end if;
    v_offer := commerce.upsert_offer(null, v_payload);
    if commerce.upsert_offer(null, v_payload)->>'id' <> v_offer->>'id'
        or (select count(*) from commerce.offers) <> v_count + 1 then
        raise exception 'test: replay created a duplicate';
    end if;
    begin
        perform commerce.upsert_offer(null, v_payload || '{"title":"Different retry"}');
        raise exception 'test: reused token accepted different values';
    exception when others then
        if sqlerrm not like 'conflict: creation token%' then raise; end if;
    end;
    if commerce.get_offer_media_download_context('admin', v_image)->>'state' <> 'ok'
        or commerce.get_offer_media_download_context('public', v_image)->>'state' <> 'not_found' then
        raise exception 'test: draft image access is incorrect';
    end if;
    begin
        perform commerce.claim_media_cleanup('offer', v_session, 'admin-a', jsonb_build_array(v_image));
        raise exception 'test: saved original was claimed';
    exception when others then
        if sqlerrm not like 'conflict: only pending images%' then raise; end if;
    end;
    v_other := (commerce.stage_media('offer', v_session, 'admin-a', false, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/two.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'two.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_media_upload('offer', v_session, 'admin-a', v_other);
    v_payload := jsonb_build_object('uploadSessionId', v_session, 'internalCmsUserId', 'admin-a',
        'title', 'Updated', 'mediaIds', jsonb_build_array(v_other, v_image));
    begin
        perform commerce.upsert_offer((v_offer->>'id')::bigint, v_payload, 0);
        raise exception 'test: stale version was accepted';
    exception when others then
        if sqlerrm <> 'conflict: stale offer version' then raise; end if;
    end;
    begin
        perform commerce.upsert_offer((v_offer->>'id')::bigint, v_payload || '{"mediaIds":[null]}', 1);
        raise exception 'test: invalid images were accepted';
    exception when others then
        if sqlerrm not like 'validation: invalid offer image%' then raise; end if;
    end;
    if (select title from commerce.offers where id = (v_offer->>'id')::bigint) <> 'Staged offer'
        or not exists (select 1 from commerce.media_uploads where media_id = v_other and state = 'ready') then
        raise exception 'test: failed Save partially committed';
    end if;
    v_result := commerce.upsert_offer((v_offer->>'id')::bigint, v_payload, 1);
    if (select media_id from commerce.offer_media where offer_id = (v_offer->>'id')::bigint and is_main) <> v_other then
        raise exception 'test: Save did not preserve the requested order';
    end if;
    perform commerce.upsert_offer((v_offer->>'id')::bigint, jsonb_build_object('mediaIds', jsonb_build_array(v_other)), (v_result->>'version')::integer);
    if (select detached_at from commerce.media where id = v_image) is null then
        raise exception 'test: removal did not retain and detach the original';
    end if;
end;
$offer_save$;
rollback;
