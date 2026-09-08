# Commerce review actions

Commerce remains at version 1.0.0. This increment migrates five independent
operations, without changing the binding engine:

| Detail | Action | Form endpoint |
| --- | --- | --- |
| Offer | Request seller price | `reviewOffer` |
| Offer | Approve offer | `reviewOffer` |
| Offer | Reject offer | `reviewOffer` |
| Seller | Verify seller | `reviewSeller` |
| Seller | Suspend seller | `reviewSeller` |

## Form behavior

Each operation opens its own modal. Technical hidden controls submit `id`,
`expectedVersion`, and the fixed action/status; these values come from the shared
resource or the definition. The form submits its own reason and, for a price
request, its required minimum and maximum amounts. Monetary values remain integer
minor units. Review-only inputs have been removed from the principal detail.

The source endpoint contracts and Edge Function adapters now require identity in
the JSON body instead of the query string. Their SQL business rules, ownership,
optimistic concurrency, and audit behavior are unchanged. The actor still comes
from the trusted CMS request context, never from a client body field.

Success reloads the shared detail source. Failed submissions retain the modal's
inputs. Closing and reopening restores the current declared values. The existing
unsaved-detail guard still requires saving or discarding the principal draft
before executing a separate operation.

Two defects exposed by these tests were corrected:

- Modal reset listeners must resolve the live form from the stable detail host;
  a listener attached only to a template node does not survive instantiation.
- `p9r-textarea` reset now reads its current `value` attribute, including values
  loaded after connection, instead of capturing an empty boot-time default.

The import contract test also now accounts for the two product staging endpoints
introduced by the earlier product work (177 endpoints, with both names asserted).

## Validation and local installation

- 13 Commerce definition, import, route mapping and read-parity tests pass.
- Five browser scenarios use the real Commerce definitions and mock responses:
  cancel/reopen, required money validation, rejected submissions, retry, delayed
  writes, exact submitted bodies, updated revisions, and retained detail sections.
- Seven existing independent-operation browser tests and 16 form-control tests
  pass, including the textarea reset regression.
- Desktop and mobile screenshots were inspected; the review modals show no
  horizontal overflow in the tested 1440 px and 390 px viewports.
- `bun run build` and `bun run check:all` pass, matching the initial 8/8 check.
- Local Courtside has the updated `commerce-offers` and `commerce-sellers`
  dashboards, the normalized source `input.params`/`input.body` contracts, and
  the two Edge Function route adapters. Existing metadata/settings were retained.
  Backups were taken before these targeted changes. The local function was
  reloaded through the Ulvia management service.
- The three offer modals and two seller modals were opened, edited, cancelled and
  reopened against real local resources. Form identities were checked. Requests
  with a deliberately nonexistent identity reached the backend and returned 404;
  no real offer or seller review was submitted. Successful mutation flows above
  therefore use mocks, not live review decisions.

## Next blocker: offer media

The principal offer Save and offer creation have not yet migrated. Offer media
currently use immediate upload/replace/remove/reorder endpoints. The existing
staged media tables and procedures belong specifically to products:
`product_upload_sessions`, `product_media_uploads`, and
`product_creation_receipts`.

The generic UI already supports media persisted with Save. The remaining work is
inside Commerce: make the staging lifecycle support offers, claim staged images
atomically in the offer save, retain existing authorization and image limits,
and clean up abandoned uploads. Creation must also work before an offer ID exists.
Changing only the view JSON would leave immediate writes or unclaimed images.

Work stops before implementing this additional backend lifecycle, as requested.
Configuration, metadata, workflow, the principal offer form and creation remain
for the subsequent migration. Legacy runtime support must remain until all its
consumers are migrated. No commits or production deployment were made here.
