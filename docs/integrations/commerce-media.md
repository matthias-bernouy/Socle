# Commerce staged media

Commerce remains at version **1.0.0**. Administrator
Product and Offer details use the shared [detail form](./dashboard-views.md)
contract and staged media persisted with Save.

## Runtime contract

- `manageOffer` without an identifier returns unpersisted defaults, the configured
  currency and price precision, and a fresh creation token. Responses are private
  and uncached. The seller-facing new-offer endpoint retains its existing contract.
- `upsertOffer` takes the identifier and expected version from the form body.
  Identity and revision are omitted on creation. Creation tokens prevent duplicate
  resources when an identical creation request is replayed; a changed payload
  using an already consumed token is rejected.
- The Images field uses `persist: "save"`, `name: "mediaIds"`, numeric identities,
  and the existing `uploadSessionId` staging field. Upload uses `stageOfferImage`.
  Existing originals use the existing administrator `offerImage` file endpoint.
- Removal, replacement and reordering update the draft selection. Save attaches
  that selection in the same transaction as the other offer fields. A failed Save
  rolls back both the resource write and media association changes.
- The authenticated CMS identity supplies upload ownership; a client-provided
  `internalCmsUserId` is discarded. Offer image limits, submitted-offer minimums,
  revision checks and existing price/publication rules remain server responsibilities.
- Request-price, approval and rejection retain their independent forms and are
  hidden until an offer exists. Their inputs are not submitted by Save.

## Shared storage lifecycle

`commerce.media_upload_sessions` and `commerce.media_uploads` replace the former
product-only staging tables. Sessions have a fixed `resource_kind`, an owner,
expiry, and separate product/offer foreign keys. A session cannot change owner,
resource kind, or resource after its first successful attachment.

The common `stage_media`, `complete_media_upload`, `claim_media_cleanup`, and
`finish_media_cleanup` functions use the same session lock as Save. Cleanup
claims a pending file before deleting its bytes through Storage. Save and cleanup
cannot both adopt the same pending image. Saved originals retain their audit
record and bytes when detached; cleanup never claims those originals.

Staging SQL lives under `connectors/supabase/install/sql/marketplace/media/staging/`.
Product and offer Save functions retain their own association tables and rules.
The TypeScript staging route and cleanup implementation are shared; the routing
layer supplies the fixed product/offer discriminator.

Abandoned uploads remain pending until expiry (24 hours). Cleanup runs on a
subsequent upload by the owner, or through the explicit discard endpoint; this
change does not add a periodic collector or promise immediate cleanup on closing
a browser tab. Signed previews expire after one hour.

## Verification and limits

The first Save navigates to the new identity and remounts its detail. Node
retention applies to subsequent edits. Removing media from a draft or closing
the browser does not promise immediate Storage deletion.

Commerce tests cover route ownership, limits, conflicts, idempotency and failed
Storage cleanup. Browser suites under Control's
`tests/browser/dashboards/workspace/product-flow/media/` and
`tests/browser/dashboards/workspace/detail-save/offers/` cover uploads, ordered
submission, cancellation, errors and retained controls.

PostgreSQL scripts under Commerce's `tests/selling/media/postgres/staging/`
exercise atomic saves, isolation and Save/cleanup races. Run them with
`psql -v ON_ERROR_STOP=1` in a disposable database containing the current Commerce
schema. The race uses `dblink` and commits fixtures; it must not use demo data.
Product lifecycle SQL tests also cover the shared implementation.
