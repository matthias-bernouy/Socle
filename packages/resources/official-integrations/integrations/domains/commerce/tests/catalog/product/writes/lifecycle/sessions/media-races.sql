create schema product_media_race_test;
create table product_media_race_test.target(product_id bigint, media_id bigint, session_id uuid);
do $$
declare
    v_id bigint;
    v_session uuid := gen_random_uuid();
    v_media bigint;
begin
    v_id := (commerce.upsert_product(null, jsonb_build_object('slug', 'media-race-' || gen_random_uuid(), 'title', 'Race'))->>'id')::bigint;
    v_media := (commerce.stage_product_media(v_session, 'admin-a', not exists(select 1 from commerce.product_upload_sessions where id=v_session), jsonb_build_object(
        'storageBucket', 'commerce-media', 'storagePath', 'upload-sessions/' || v_session || '/race.png',
        'mimeType', 'image/png', 'fileSize', 100, 'originalFilename', 'race.png', 'width', 1, 'height', 1
    ))->>'media_id')::bigint;
    perform commerce.complete_product_media_upload(v_session, 'admin-a', v_media);
    insert into product_media_race_test.target values(v_id, v_media, v_session);
end;
$$;
create function product_media_race_test.run(p_save boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_target product_media_race_test.target%rowtype;
    v_result jsonb;
begin
    select * into strict v_target from product_media_race_test.target;
    if p_save then
        v_result := commerce.upsert_product(v_target.product_id,
            jsonb_build_object('mediaIds', jsonb_build_array(v_target.media_id), 'uploadSessionId', v_target.session_id, 'internalCmsUserId', 'admin-a'), 1);
    else
        v_result := commerce.claim_product_media_cleanup(v_target.session_id, 'admin-a',
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
select id from commerce.product_upload_sessions where id = (select session_id from product_media_race_test.target) for update;
select dblink_send_query('media_save', 'select product_media_race_test.run(true)');
select dblink_send_query('media_discard', 'select product_media_race_test.run(false)');
commit;
create temporary table product_media_race_results(result jsonb);
insert into product_media_race_results select result from dblink_get_result('media_save') response(result jsonb);
insert into product_media_race_results select result from dblink_get_result('media_discard') response(result jsonb);
do $$
begin
    if (select count(*) from product_media_race_results where result->>'ok' = 'true') <> 1 then
        raise exception 'test: Save and cleanup must have exactly one winner: %',
            (select jsonb_agg(result) from product_media_race_results);
    end if;
    if exists (
        select 1 from commerce.product_media saved
        join commerce.product_media_uploads pending on pending.media_id = saved.media_id
        where pending.state = 'deleting'
    ) then raise exception 'test: cleanup claimed a saved original'; end if;
end;
$$;
select dblink_disconnect('media_save');
select dblink_disconnect('media_discard');
drop schema product_media_race_test cascade;
