# Commerce offer forms and staged media

Commerce remains at version **1.0.0**. This change migrates the administrator
`offerDetail` to the existing detail `save` and `create` contracts. It does not
change the binding engine or the media input component.

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

## Verification

- Commerce route and definition tests cover typed form submissions, stable retry
  slugs, authenticated ownership, missing revisions, settings-based defaults,
  staging failures, failed Storage cleanup, and the unchanged seller endpoints.
- Browser tests use the actual Commerce definitions. They cover creation, editing,
  a delayed Save, failed writes, a failed post-save GET with read-only retry,
  ordered media submission, replacement, removal, abandonment, shared revisions,
  independent review forms and the absence of nested forms.
- PostgreSQL scripts under `tests/selling/media/postgres/staging/` cover atomic
  creation, idempotency, ownership and resource isolation, image limits, stale
  revisions, cleanup, retention, and a concurrent Save/cleanup race. Run them via
  `psql -v ON_ERROR_STOP=1` against a disposable database with the current Commerce
  schema. The race uses `dblink` and commits its fixture; it needs a suitable
  database role/connection and must not run against the demo database.
- Existing product staging, creation, cleanup and concurrency SQL scripts also
  pass against the shared implementation. The schema installs in a fresh database.
- Real localhost testing created an offer with a product variant and a PNG, saved
  it, reloaded the image, then edited the offer. Creation plus GET took about
  226 ms in that run. Upload and subsequent edit Save retained the title input node.

Local installation used a Commerce SQL backup, a guarded table rename preserving
existing product sessions, targeted function updates, backed-up Source/dashboard
records, and the local function-management service. Production was not accessed.

## Responsive action row

The generic `.w-detail-actions` row now uses `flex-wrap: wrap` and `min-width: 0`.
Previously, its non-wrapping buttons forced offer sections to about 549 px at a
390 px viewport. An ancestor clipped the excess even though
`document.documentElement.scrollWidth` stayed at 390 px.

The browser regression checks the actual bounds of visible sections, controls
and all four action buttons at 320, 390, 768 and 1440 px. It also opens and closes
an independent action without replacing the parent title input. Local screenshots
confirm the fix: at 390 px, sections are 358 px wide and their right edge is
374 px. The correction belongs to `w-detail`; Commerce definitions and the
binding engine do not implement responsive behavior.

The first Save of a new resource also uses the existing navigation from the
creation row to the persisted identity and remounts the detail. The node-retention
assertion applies to subsequent saves, not to this identity transition.
