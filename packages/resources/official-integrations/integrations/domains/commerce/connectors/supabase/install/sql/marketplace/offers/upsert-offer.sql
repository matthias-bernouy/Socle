

create or replace function commerce.upsert_offer(
    p_offer_id bigint,
    p_payload jsonb,
    p_expected_version integer default null,
    p_admin_id text default 'cms-admin'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    v_offer commerce.offers%rowtype;
    v_seller commerce.sellers%rowtype;
    v_settings commerce.settings%rowtype;
    v_metadata jsonb;
    v_metadata_patch jsonb;
    v_seller_id bigint;
    v_product_id bigint;
    v_variant_id bigint;
    v_session_id uuid := nullif(p_payload->>'uploadSessionId', '')::uuid;
    v_owner_id text := nullif(p_payload->>'internalCmsUserId', '');
    v_token uuid := nullif(p_payload->>'creationToken', '')::uuid;
    v_receipt commerce.offer_creation_receipts%rowtype;
    v_hash text := md5((p_payload - 'internalCmsUserId')::text);
begin
    if p_offer_id is null and v_token is not null then
        if v_owner_id is null then raise exception 'validation: creation owner is required'; end if;
        perform pg_advisory_xact_lock(hashtextextended('offer:' || v_owner_id || ':' || v_token, 0));
        select * into v_receipt from commerce.offer_creation_receipts where owner_id = v_owner_id and token = v_token;
        if found then
            if v_receipt.payload_hash <> v_hash then raise exception 'conflict: creation token was already used with different values'; end if;
            select * into v_offer from commerce.offers where id = v_receipt.offer_id;
            return to_jsonb(v_offer);
        end if;
    end if;
    if v_session_id is not null then perform commerce.lock_media_upload_session('offer', v_session_id, v_owner_id); end if;
    select * into v_settings from commerce.settings where id = 'default' for share;
    if p_payload ? 'acceptedPriceAmount' then
        perform commerce.assert_offer_price_increment(
            nullif(p_payload->>'acceptedPriceAmount', '')::bigint,
            'accepted price'
        );
    end if;
    if p_offer_id is null then
        v_seller_id := nullif(p_payload->>'sellerId', '')::bigint;
        if v_seller_id is null then
            select id into v_seller_id from commerce.sellers where kind = 'merchant' and slug = 'default';
        end if;
        perform id from commerce.sellers where id = v_seller_id for share;
        if not found then raise exception 'not_found: seller'; end if;
        v_product_id := nullif(p_payload->>'productId', '')::bigint;
        v_variant_id := nullif(p_payload->>'variantId', '')::bigint;
        perform id from commerce.products where id = v_product_id for share;
        if not found then raise exception 'not_found: product'; end if;
        perform commerce.assert_product_variant_ready(v_product_id, v_variant_id);
        perform code from commerce.offer_workflow_states
        where code = coalesce(nullif(p_payload->>'workflowState', ''), 'draft')
        for share;
        if not found then raise exception 'validation: unsupported workflow state'; end if;
        if not exists (
            select 1 from commerce.offer_conditions
            where code = coalesce(nullif(p_payload->>'conditionCode', ''), 'good') and enabled
        ) then
            raise exception 'validation: unsupported offer condition';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), 'draft') = 'active'
            and not exists (
                select 1 from commerce.products
                where id = v_product_id and status = 'active' and visibility = 'public'
            ) then
            raise exception 'validation: an active public product is required to publish an offer';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), 'draft') = 'active'
            and not exists (
                select 1 from commerce.offer_workflow_states
                where code = coalesce(nullif(p_payload->>'workflowState', ''), 'draft')
                  and phase = 'ready' and enabled
            ) then
            raise exception 'validation: an offer must be in a ready workflow state before publication';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), 'draft') = 'active' then
            perform commerce.assert_offer_publication_ready(
                v_seller_id,
                v_product_id,
                v_variant_id,
                coalesce(nullif(p_payload->>'workflowState', ''), 'draft'),
                nullif(p_payload->>'acceptedPriceAmount', '')::bigint
            );
        end if;
        v_metadata := coalesce(p_payload->'metadata', '{}'::jsonb);
        perform commerce.assert_custom_fields('offer', v_metadata, 'admin');
        insert into commerce.offers (
            seller_id, product_id, variant_id, slug, title, description, condition_code,
            publication_status, workflow_state, accepted_price_amount, currency,
            availability, quantity_available, metadata
        ) values (
            v_seller_id, v_product_id, v_variant_id, lower(btrim(p_payload->>'slug')),
            btrim(p_payload->>'title'), nullif(btrim(p_payload->>'description'), ''),
            coalesce(nullif(p_payload->>'conditionCode', ''), 'good'),
            coalesce(nullif(p_payload->>'publicationStatus', ''), 'draft'),
            coalesce(nullif(p_payload->>'workflowState', ''), 'draft'),
            nullif(p_payload->>'acceptedPriceAmount', '')::bigint,
            lower(coalesce(nullif(p_payload->>'currency', ''), v_settings.default_currency)),
            coalesce(nullif(p_payload->>'availability', ''), 'available'),
            nullif(p_payload->>'quantityAvailable', '')::integer,
            v_metadata
        ) returning * into v_offer;
        insert into commerce.offer_events (
            offer_id, event_type, actor_kind, actor_id, previous_workflow_state, next_workflow_state
        ) values (
            v_offer.id, 'created', 'admin', coalesce(nullif(p_admin_id, ''), 'cms-admin'),
            null, v_offer.workflow_state
        );
    else
        if p_expected_version is null then raise exception 'validation: expected offer version is required'; end if;
        select * into v_offer from commerce.offers where id = p_offer_id for update;
        if not found then raise exception 'not_found: offer'; end if;
        if v_offer.version is distinct from p_expected_version then
            raise exception 'conflict: stale offer version';
        end if;
        if exists (
            select 1 from commerce.offer_price_rules where offer_id = v_offer.id
            union all
            select 1 from commerce.offer_price_proposals where offer_id = v_offer.id
        ) and (
            (p_payload ? 'acceptedPriceAmount' and nullif(p_payload->>'acceptedPriceAmount', '')::bigint is distinct from v_offer.accepted_price_amount)
            or (p_payload ? 'currency' and lower(p_payload->>'currency') is distinct from v_offer.currency)
        ) then
            raise exception 'conflict: reviewed price and currency must be changed through the price workflow';
        end if;
        if p_payload ? 'metadata' then
            v_metadata_patch := p_payload->'metadata';
            perform commerce.assert_custom_field_patch('offer', v_metadata_patch, 'admin');
            v_metadata := v_offer.metadata || v_metadata_patch;
        else
            v_metadata := v_offer.metadata;
        end if;
        perform commerce.assert_custom_fields('offer', v_metadata, 'system');
        if not exists (
            select 1 from commerce.offer_conditions
            where code = coalesce(nullif(p_payload->>'conditionCode', ''), v_offer.condition_code) and enabled
        ) then
            raise exception 'validation: unsupported offer condition';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), v_offer.publication_status) = 'active'
            and not exists (
                select 1 from commerce.products
                where id = v_offer.product_id and status = 'active' and visibility = 'public'
            ) then
            raise exception 'validation: an active public product is required to publish an offer';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), v_offer.publication_status) = 'active'
            and not exists (
                select 1 from commerce.offer_workflow_states
                where code = coalesce(nullif(p_payload->>'workflowState', ''), v_offer.workflow_state)
                  and phase = 'ready' and enabled
            ) then
            raise exception 'validation: an offer must be in a ready workflow state before publication';
        end if;
        if coalesce(nullif(p_payload->>'publicationStatus', ''), v_offer.publication_status) = 'active' then
            perform commerce.assert_offer_publication_ready(
                v_offer.seller_id,
                v_offer.product_id,
                v_offer.variant_id,
                coalesce(nullif(p_payload->>'workflowState', ''), v_offer.workflow_state),
                case when p_payload ? 'acceptedPriceAmount'
                    then nullif(p_payload->>'acceptedPriceAmount', '')::bigint
                    else v_offer.accepted_price_amount
                end
            );
        end if;
        update commerce.offers
        set slug = coalesce(nullif(lower(btrim(p_payload->>'slug')), ''), slug),
            title = coalesce(nullif(btrim(p_payload->>'title'), ''), title),
            description = case when p_payload ? 'description' then nullif(btrim(p_payload->>'description'), '') else description end,
            condition_code = coalesce(nullif(p_payload->>'conditionCode', ''), condition_code),
            publication_status = coalesce(nullif(p_payload->>'publicationStatus', ''), publication_status),
            workflow_state = coalesce(nullif(p_payload->>'workflowState', ''), workflow_state),
            accepted_price_amount = case when p_payload ? 'acceptedPriceAmount' then nullif(p_payload->>'acceptedPriceAmount', '')::bigint else accepted_price_amount end,
            currency = coalesce(nullif(lower(p_payload->>'currency'), ''), currency),
            availability = coalesce(nullif(p_payload->>'availability', ''), availability),
            quantity_available = case when p_payload ? 'quantityAvailable' then nullif(p_payload->>'quantityAvailable', '')::integer else quantity_available end,
            inventory_revision = case
                when p_payload ? 'availability' or p_payload ? 'quantityAvailable' then inventory_revision + 1
                else inventory_revision
            end,
            metadata = v_metadata
        where id = p_offer_id
        returning * into v_offer;
        insert into commerce.offer_events (offer_id, event_type, actor_kind, actor_id)
        values (v_offer.id, 'details_updated', 'admin', coalesce(nullif(p_admin_id, ''), 'cms-admin'));
    end if;
    if p_payload ? 'mediaIds' then
        perform commerce.save_offer_media(v_offer.id, p_payload->'mediaIds', v_session_id, v_owner_id);
        if v_offer.workflow_state <> 'draft' and (
            select count(*) from commerce.offer_media where offer_id = v_offer.id
        ) < v_settings.offer_image_min_count then
            raise exception 'validation: a submitted offer must keep at least % images', v_settings.offer_image_min_count;
        end if;
    end if;
    if p_offer_id is null and v_token is not null then
        insert into commerce.offer_creation_receipts(owner_id, token, payload_hash, offer_id)
        values (v_owner_id, v_token, v_hash, v_offer.id);
    end if;
    return to_jsonb(v_offer);
end;
$$;
