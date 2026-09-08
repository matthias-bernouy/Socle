create or replace function commerce.save_offer_media(p_offer_id bigint, p_media_ids jsonb, p_session_id uuid default null, p_owner_id text default null)
returns void language plpgsql set search_path = '' as $$
declare
    v_ids bigint[];
    v_removed bigint[];
    v_max integer;
begin
    if p_session_id is not null then
        perform commerce.lock_media_upload_session('offer', p_session_id, p_owner_id);
        update commerce.media_upload_sessions set offer_id = p_offer_id
        where id = p_session_id and (offer_id is null or offer_id = p_offer_id);
        if not found then raise exception 'conflict: upload session belongs to another offer'; end if;
    end if;
    perform id from commerce.offers where id = p_offer_id for update;
    if not found then raise exception 'not_found: offer'; end if;
    if jsonb_typeof(p_media_ids) is distinct from 'array' then
        raise exception 'validation: mediaIds must be an array';
    end if;
    if exists (select 1 from jsonb_array_elements_text(p_media_ids) value where value !~ '^[1-9][0-9]*$') then
        raise exception 'validation: mediaIds must contain positive integers';
    end if;
    select coalesce(array_agg(value::bigint), '{}'::bigint[]) into v_ids
    from jsonb_array_elements_text(p_media_ids) value;
    select offer_image_max_count into v_max from commerce.settings where id = 'default' for share;
    if cardinality(v_ids) > v_max or cardinality(v_ids) <> (select count(distinct id) from unnest(v_ids) id)
        or array_position(v_ids, null) is not null then
        raise exception 'validation: invalid offer image selection';
    end if;
    perform media_id from commerce.media_uploads where session_id = p_session_id order by media_id for update;
    if exists (
        select 1 from unnest(v_ids) candidate(media_id) where not exists (
            select 1 from commerce.offer_media where offer_id = p_offer_id and media_id = candidate.media_id
        ) and not exists (
            select 1 from commerce.media_uploads
            where session_id = p_session_id and media_id = candidate.media_id and state = 'ready' and expires_at > now()
        )
    ) then raise exception 'validation: offer image is unavailable or belongs to another offer'; end if;
    select coalesce(array_agg(media_id), '{}'::bigint[]) into v_removed from commerce.offer_media
    where offer_id = p_offer_id and not (media_id = any(v_ids));
    delete from commerce.offer_media where offer_id = p_offer_id and media_id = any(v_removed);
    update commerce.offer_media set is_main = false where offer_id = p_offer_id;
    insert into commerce.offer_media (offer_id, media_id, sort_order, is_main)
    select p_offer_id, id, position - 1, position = 1 from unnest(v_ids) with ordinality selected(id, position)
    on conflict (offer_id, media_id) do update set sort_order = excluded.sort_order, is_main = excluded.is_main;
    delete from commerce.media_uploads where session_id = p_session_id and media_id = any(v_ids);
    -- Saved originals retain their audit record and bytes; only abandoned uploads are collected.
    update commerce.media media set detached_at = now()
    where id = any(v_removed) and detached_at is null
        and not exists (select 1 from commerce.product_media where media_id = media.id)
        and not exists (select 1 from commerce.offer_media where media_id = media.id);
end;
$$;

revoke execute on function commerce.save_offer_media(bigint, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function commerce.save_offer_media(bigint, jsonb, uuid, text) to service_role;
