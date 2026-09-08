create table if not exists commerce.product_creation_receipts (
    owner_id text not null,
    token uuid not null,
    payload_hash text not null,
    product_id bigint not null references commerce.products(id) on delete restrict,
    primary key (owner_id, token)
);
alter table commerce.product_creation_receipts enable row level security;
alter table commerce.product_creation_receipts force row level security;
