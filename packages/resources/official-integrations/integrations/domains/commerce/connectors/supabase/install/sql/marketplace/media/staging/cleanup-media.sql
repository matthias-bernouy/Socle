-- Claim under the same upload-session lock as Save before deleting bytes through Storage.
create or replace function commerce.claim_media_cleanup(p_resource_kind text, p_session_id uuid, p_owner_id text, p_media_ids jsonb default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_ids bigint[];
    v_result jsonb;
    v_session uuid;
    v_items jsonb := '[]'::jsonb;
begin
    if p_session_id is null then
        if nullif(btrim(p_owner_id), '') is null or p_media_ids is not null then
            raise exception 'validation: cleanup owner is required';
        end if;
        for v_session in
            select session.id from commerce.media_upload_sessions session
            where session.owner_id = p_owner_id and session.resource_kind = p_resource_kind and exists (
                select 1 from commerce.media_uploads pending where pending.session_id = session.id
                    and (session.expires_at <= now() or pending.expires_at <= now() or pending.state = 'deleting')
            ) order by session.id limit 20 for update skip locked
        loop
            v_items := v_items || (commerce.claim_media_cleanup(p_resource_kind, v_session, p_owner_id)->'items');
        end loop;
        return jsonb_build_object('items', v_items);
    end if;
    perform commerce.lock_media_upload_session(p_resource_kind, p_session_id, p_owner_id, true);
    if p_media_ids is not null and jsonb_typeof(p_media_ids) <> 'array' then
        raise exception 'validation: mediaIds must be an array';
    end if;
    if p_media_ids is not null then
        select coalesce(array_agg(value::bigint), '{}'::bigint[]) into v_ids
        from jsonb_array_elements_text(p_media_ids) value;
        if exists (select 1 from unnest(v_ids) candidate(media_id) where not exists (
            select 1 from commerce.media_uploads where session_id = p_session_id and media_id = candidate.media_id
        )) then raise exception 'conflict: only pending images can be discarded'; end if;
    end if;
    update commerce.media_uploads set state = 'deleting'
    where session_id = p_session_id and (
        (v_ids is not null and media_id = any(v_ids)) or
        (v_ids is null and (expires_at <= now() or state = 'deleting' or exists (
            select 1 from commerce.media_upload_sessions where id = p_session_id and expires_at <= now()
        )))
    );
    select coalesce(jsonb_agg(jsonb_build_object(
        'sessionId', p_session_id, 'mediaId', media.id, 'storageBucket', media.storage_bucket, 'storagePath', media.storage_path
    )), '[]'::jsonb) into v_result
    from commerce.media_uploads pending join commerce.media media on media.id = pending.media_id
    where pending.session_id = p_session_id and pending.state = 'deleting';
    return jsonb_build_object('items', v_result);
end;
$$;

create or replace function commerce.finish_media_cleanup(p_resource_kind text, p_session_id uuid, p_owner_id text, p_media_id bigint)
returns void language plpgsql set search_path = '' as $$
begin
    perform commerce.lock_media_upload_session(p_resource_kind, p_session_id, p_owner_id, true);
    delete from commerce.media_uploads
    where session_id = p_session_id and media_id = p_media_id and state = 'deleting';
    if found then
        update commerce.media set detached_at = coalesce(detached_at, now()) where id = p_media_id;
    end if;
end;
$$;
