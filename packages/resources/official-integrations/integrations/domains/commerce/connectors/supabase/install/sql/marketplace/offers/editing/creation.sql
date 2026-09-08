create table if not exists commerce.offer_creation_receipts (
    owner_id text not null,
    token uuid not null,
    payload_hash text not null,
    offer_id bigint not null references commerce.offers(id) on delete restrict,
    primary key (owner_id, token)
);
alter table commerce.offer_creation_receipts enable row level security;
alter table commerce.offer_creation_receipts force row level security;
revoke all on commerce.offer_creation_receipts from public, anon, authenticated;
grant select, insert, update, delete on commerce.offer_creation_receipts to service_role;
