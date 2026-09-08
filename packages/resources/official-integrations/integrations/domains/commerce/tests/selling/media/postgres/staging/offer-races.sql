\set ON_ERROR_STOP on
create schema offer_media_race_test;
create table offer_media_race_test.target(offer_id bigint, media_id bigint, session_id uuid);
do $$
declare
    v_id bigint;
    v_session uuid := gen_random_uuid();
    v_media bigint;
begin
    v_id := (commerce.upsert_offer(null, jsonb_build_object('productId', (commerce.upsert_product(null, jsonb_build_object('slug', 'offer-media-parent-' || gen_random_uuid(), 'title', 'Parent'))->>'id')::bigint, 'slug', 'media-race-' || gen_random_uuid(), 'title', 'Race'))->>'id')::bigint;
    v_media := (commerce.stage_media('offer', v_session, 'admin-a', not exists(select 1 from commerce.media_upload_sessions where id=v_session), jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/race.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'race.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_media_upload('offer', v_session, 'admin-a', v_media);
    insert into offer_media_race_test.target values(v_id, v_media, v_session);
end;
$$;
create function offer_media_race_test.run(p_save boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_target offer_media_race_test.target%rowtype;
    v_result jsonb;
begin
    select * into strict v_target from offer_media_race_test.target;
    if p_save then
        v_result := commerce.upsert_offer(v_target.offer_id,
            jsonb_build_object('mediaIds', jsonb_build_array(v_target.media_id), 'uploadSessionId', v_target.session_id, 'internalCmsUserId', 'admin-a'), 1);
    else
        v_result := commerce.claim_media_cleanup('offer', v_target.session_id, 'admin-a',
            jsonb_build_array(v_target.media_id));
    end if;
    return jsonb_build_object('ok', true, 'saved', p_save, 'result', v_result);
exception when others then
    return jsonb_build_object('ok', false, 'saved', p_save, 'error', sqlerrm);
end;
$$;
create extension if not exists dblink;
select dblink_connect('media_save', 'dbname=' || current_database());
select dblink_connect('media_discard', 'dbname=' || current_database());
begin;
select id from commerce.media_upload_sessions where id = (select session_id from offer_media_race_test.target) for update;
select dblink_send_query('media_save', 'select offer_media_race_test.run(true)');
select dblink_send_query('media_discard', 'select offer_media_race_test.run(false)');
commit;
create temporary table offer_media_race_results(result jsonb);
insert into offer_media_race_results select result from dblink_get_result('media_save') response(result jsonb);
insert into offer_media_race_results select result from dblink_get_result('media_discard') response(result jsonb);
do $$
begin
    if (select count(*) from offer_media_race_results where result->>'ok' = 'true') <> 1 then
        raise exception 'test: Save and cleanup must have exactly one winner: %',
            (select jsonb_agg(result) from offer_media_race_results);
    end if;
    if exists (
        select 1 from commerce.offer_media saved
        join commerce.media_uploads pending on pending.media_id = saved.media_id
        where pending.state = 'deleting'
    ) then raise exception 'test: cleanup claimed a saved original'; end if;
end;
$$;
select dblink_disconnect('media_save');
select dblink_disconnect('media_discard');
drop schema offer_media_race_test cascade;
