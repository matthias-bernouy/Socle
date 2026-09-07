-- Upload sessions belong to an authenticated CMS administrator, before any product exists.
create table if not exists commerce.product_upload_sessions (
    id uuid primary key,
    owner_id text not null check (btrim(owner_id) <> ''),
    product_id bigint references commerce.products(id) on delete restrict,
    expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists product_upload_sessions_owner_idx on commerce.product_upload_sessions(owner_id, expires_at);
create table if not exists commerce.product_creation_receipts (
    owner_id text not null,
    token uuid not null,
    payload_hash text not null,
    product_id bigint not null references commerce.products(id) on delete restrict,
    primary key (owner_id, token)
);
create table if not exists commerce.product_media_uploads (
    media_id bigint primary key references commerce.media(id) on delete restrict,
    session_id uuid not null references commerce.product_upload_sessions(id) on delete restrict,
    state text not null default 'uploading' check (state in ('uploading', 'ready', 'deleting')),
    expires_at timestamptz not null default now() + interval '24 hours'
);
create index if not exists product_media_uploads_session_idx on commerce.product_media_uploads(session_id, media_id);
create index if not exists product_media_uploads_expiry_idx on commerce.product_media_uploads(expires_at);
alter table commerce.product_upload_sessions enable row level security;
alter table commerce.product_upload_sessions force row level security;
alter table commerce.product_creation_receipts enable row level security;
alter table commerce.product_creation_receipts force row level security;
alter table commerce.product_media_uploads enable row level security;
alter table commerce.product_media_uploads force row level security;

create or replace function commerce.lock_product_upload_session(p_session_id uuid, p_owner_id text, p_allow_expired boolean default false)
returns void language plpgsql set search_path = '' as $$
declare v_session commerce.product_upload_sessions%rowtype;
begin
    select * into v_session from commerce.product_upload_sessions where id = p_session_id for update;
    if not found or v_session.owner_id is distinct from p_owner_id or nullif(btrim(p_owner_id), '') is null then
        raise exception 'not_found: upload session';
    end if;
    if not p_allow_expired and v_session.expires_at <= now() then raise exception 'conflict: upload session expired'; end if;
end;
$$;

create or replace function commerce.stage_product_media(p_session_id uuid, p_owner_id text, p_create_session boolean, p_payload jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
    v_media commerce.media%rowtype;
    v_max integer;
begin
    if p_create_session then
        insert into commerce.product_upload_sessions(id, owner_id) values (p_session_id, p_owner_id);
    end if;
    perform commerce.lock_product_upload_session(p_session_id, p_owner_id);
    select product_image_max_count into v_max from commerce.settings where id = 'default' for share;
    if (select count(*) from commerce.product_media_uploads where session_id = p_session_id) >= v_max * 2 then
        raise exception 'validation: too many pending product images';
    end if;
    if p_payload->>'storageBucket' <> 'commerce-media'
        or p_payload->>'storagePath' not like 'upload-sessions/' || p_session_id || '/%' then
        raise exception 'validation: invalid staged product image location';
    end if;
    insert into commerce.media (
        storage_bucket, storage_path, mime_type, file_size, original_filename, width, height
    ) values (
        p_payload->>'storageBucket', p_payload->>'storagePath', p_payload->>'mimeType',
        (p_payload->>'fileSize')::bigint, p_payload->>'originalFilename',
        (p_payload->>'width')::integer, (p_payload->>'height')::integer
    ) returning * into v_media;
    insert into commerce.product_media_uploads (session_id, media_id) values (p_session_id, v_media.id);
    return to_jsonb(v_media) || jsonb_build_object('media_id', v_media.id);
end;
$$;

create or replace function commerce.complete_product_media_upload(p_session_id uuid, p_owner_id text, p_media_id bigint)
returns jsonb language plpgsql set search_path = '' as $$
begin
    perform commerce.lock_product_upload_session(p_session_id, p_owner_id);
    update commerce.product_media_uploads set state = 'ready'
    where session_id = p_session_id and media_id = p_media_id
        and state = 'uploading' and expires_at > now();
    if not found then raise exception 'conflict: product image upload expired'; end if;
    return jsonb_build_object('ok', true, 'media_id', p_media_id);
end;
$$;
