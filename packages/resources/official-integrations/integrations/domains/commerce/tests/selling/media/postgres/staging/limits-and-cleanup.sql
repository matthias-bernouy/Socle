\set ON_ERROR_STOP on
begin;
update commerce.settings set offer_image_max_count = 1, offer_image_min_count = 1 where id = 'default';
set local role service_role;
do $offer_limits$
declare
    v_session uuid := gen_random_uuid();
    v_product bigint;
    v_one bigint;
    v_two bigint;
    v_offer bigint;
    v_payload jsonb;
    v_claim jsonb;
begin
    v_product := (commerce.upsert_product(null, '{"slug":"offer-limits-parent","title":"Parent"}')->>'id')::bigint;
    v_one := (commerce.stage_media('offer', v_session, 'offer-limits-admin-a', true, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/one.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'one.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    v_two := (commerce.stage_media('offer', v_session, 'offer-limits-admin-a', false, jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/two.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'two.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_media_upload('offer', v_session, 'offer-limits-admin-a', v_one);
    perform commerce.complete_media_upload('offer', v_session, 'offer-limits-admin-a', v_two);
    v_payload := jsonb_build_object('productId', v_product, 'slug', 'offer-limits', 'title', 'Limits',
        'mediaIds', jsonb_build_array(v_one, v_two), 'uploadSessionId', v_session, 'internalCmsUserId', 'offer-limits-admin-a');
    begin
        perform commerce.upsert_offer(null, v_payload);
        raise exception 'test: offer image limit was ignored';
    exception when others then
        if sqlerrm <> 'validation: invalid offer image selection' then raise; end if;
    end;
    v_offer := (commerce.upsert_offer(null, v_payload || jsonb_build_object('mediaIds', jsonb_build_array(v_one)))->>'id')::bigint;
    begin
        perform commerce.upsert_offer(v_offer, '{"workflowState":"pending_review","mediaIds":[]}', 1);
        raise exception 'test: submitted offer lost its required images';
    exception when others then
        if sqlerrm not like 'validation: a submitted offer must keep%' then raise; end if;
    end;
    begin
        perform commerce.upsert_offer(null, v_payload || jsonb_build_object('slug', 'another-offer', 'mediaIds', jsonb_build_array(v_two)));
        raise exception 'test: session was transferred to a second offer';
    exception when others then
        if sqlerrm <> 'conflict: upload session belongs to another offer' then raise; end if;
    end;
    begin
        perform commerce.upsert_offer(null, (v_payload - 'uploadSessionId') || jsonb_build_object('slug', 'another-offer', 'mediaIds', jsonb_build_array(v_one)));
        raise exception 'test: another offer adopted a saved image';
    exception when others then
        if sqlerrm not like 'validation: offer image is unavailable%' then raise; end if;
    end;
    update commerce.media_uploads set expires_at = now() - interval '1 second' where media_id = v_two;
    if commerce.claim_media_cleanup('offer', null, 'offer-limits-admin-b')->'items' <> '[]'::jsonb
        or commerce.claim_media_cleanup('product', null, 'offer-limits-admin-a')->'items' <> '[]'::jsonb then
        raise exception 'test: cleanup crossed an owner or resource boundary';
    end if;
    v_claim := commerce.claim_media_cleanup('offer', null, 'offer-limits-admin-a');
    if jsonb_array_length(v_claim->'items') <> 1 or (v_claim->'items'->0->>'mediaId')::bigint <> v_two then
        raise exception 'test: expired pending image was not claimed exclusively';
    end if;
    perform commerce.finish_media_cleanup('offer', v_session, 'offer-limits-admin-a', v_two);
    if exists(select 1 from commerce.media_uploads where media_id = v_two)
        or (select detached_at from commerce.media where id = v_two) is null
        or (select detached_at from commerce.media where id = v_one) is not null then
        raise exception 'test: cleanup did not retain the original correctly';
    end if;
end;
$offer_limits$;
rollback;
