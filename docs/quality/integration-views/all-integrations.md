# Integration detail migration — September 2026

This increment migrates the remaining compatible dashboards to the existing
shared detail form and independent operation forms. Integration versions remain
`1.0.0`. It does not remove the legacy runtime while the blockers below still
depend on it. Earlier Product, Offer, Brand, Category and Seller work remains in
place.

## Migrated scope

Twenty-two detail views are fully or partially migrated in this increment:

| Integration | Views | Result |
| --- | --- | --- |
| Commerce | General settings, notifications, protected C2C policy, offer condition, custom metadata, workflow state and transition | Native Save; metadata deletion; creation through the detail where supported |
| Forms | Form, section, submission | Publish/archive independent forms; section Save/Delete; submission review/archive. Principal form draft editing is deferred |
| User Account | Account and extra field | Native Save/Delete; extra-field creation and native list reordering |
| Emailer | Template | Native Save/Create; independent test-email and archive forms |
| Mondial Relay | Shipment and settings | Independent shipment recovery; native settings Save |
| Commerce Negotiation | Settings and proposal | Native settings Save; independent cancellation form |
| Commerce Stripe Payments | Protected payment, claim, refund request, Stripe dispute, provider exception | Independent release/refund, resolution, review, evidence, accept and requeue forms |

Readonly details and GET downloads/navigation retain their existing contracts.
Mossa, Ulvia and the two Commerce Mondial Relay extensions have no detail forms
to migrate. Newsletter's subscription export remains a GET download.

## Form and endpoint contracts

- Editable controls declare their submission names. Numeric and boolean fields
  submit typed values; required API booleans still permit `false`.
- Hidden inputs carry stable identity, revision and operation constants. They
  do not mirror editable controls or transport a whole resource object.
- Operation-only inputs move into the independent modal form. They no longer
  appear as editable fields in the principal detail. Persisted eligibility uses
  `$resource`, including readonly status values.
- Successful operations reload the shared GET. Ordinary edits preserve existing
  detail nodes. First creation still navigates to the returned identity and
  mounts the persisted detail, as in the existing creation contract.
- Cross-source Stripe operations retain their explicit dependency source.
- User Account and Emailer deletion/archive adapters accept body identities,
  preserve query compatibility and reject conflicting identities. Commerce
  metadata deletion accepts its composite identity in the body.
- Commerce metadata and workflow transition GET/upsert responses expose their
  existing composite identity as `id`, allowing first-save navigation.
- User Account returns defaults when no field identity is supplied. Emailer's
  default GET contract permits an omitted key. Email template upserts preserve
  integration-owned metadata when the editor does not submit it.

No SQL schema migration or binding-core extension is introduced here.

## Small shared corrections

1. Source overlays recognize a same-source `save.endpoint`, so additional User
   Account fields remain editable after migration.
2. Persisted/creation mode uses the detail's row identity. A response envelope
   such as `{ field: ... }` must not make an existing field look unsaved.
3. Native Save honors an existing `confirm` declaration, including policy
   publication. Cancelling sends no request.
4. The declared readonly `url` format now has a binding template. Only HTTP(S)
   links are clickable, and long links wrap on narrow screens.
5. `p9r-input` resets to its current `value` attribute, matching native defaults
   loaded after connection. This prevents operation modal resets from erasing
   loaded text and numeric values.
6. The reorderable field exposes the existing form-associated `form`/`value`
   contract, like the table field. Its rows remain ordinary bound light-DOM
   content; the form reads their structured value without a hidden JSON payload.

## Deferred work and reasons

| Case | Why a direct migration is unsafe | Required follow-up |
| --- | --- | --- |
| Consent details and Stripe Connect seller terms | These call integration management actions, rather than source form endpoints. Publishing also owns immutable legal snapshots | Define the management/native-form boundary and preserve publication semantics |
| Forms creation and principal draft Save | The current operation submits the entire `draftDefinition`. Omitting it falls back to a starter definition and can erase existing sections/questions | Add an atomic metadata-only update contract or a deliberate draft editor contract |
| Forms question editor | Nested options and image choices still use immediate media writes | Migrate the complex field/media lifecycle before changing its Save/Delete wiring |
| Forms nested section/question navigation | Create/reorder depends on ancestor selection; controls are nested inside the parent detail | Compose independent forms outside the principal form with explicit ancestor identity |
| Mondial Relay projection-exception table action | Native independent forms are currently composed for details, not table-row operations | Provide a reusable table operation form host |

The old action runtime cannot yet be deleted. An empty legacy-source-action list
alone does not prove a migration is complete: integration management actions
must also be inventoried.

## Validation

- Initial and final `bun run check:all`: 8 checks pass. UI contracts remain at
  0 errors, 63 warnings and 11 informational findings, matching the baseline.
- The 38 new browser tests use resolved official definitions and the real built
  admin bundle. It covers all 22 migrated views, six creations, four deletions,
  two Emailer operations, a delayed/conflicting Save, policy confirmation,
  readonly URLs and structured allowed values. Mocked provider operations do
  not send real payments, refunds, shipping labels or emails.
- Exact required payloads and scalar types are asserted. The structured-field
  regression covers edited rows and submission of an empty list after removal.
- Tests check the shared reread, updated revision, retained nodes, geometry
  during an ordinary Save, and screenshots at desktop/mobile widths.
- The full official integration suite before the final control-only correction
  reports 1,574 passes, one skipped live carrier probe and two failures. Those
  failures concern pre-existing combined-installation answers and resource
  bundle hygiene: three orphaned Emailer settings fragments and two 182-line
  management fragments. They are not fixed as part of this migration.
- Focused source-overlay, form reset, Emailer and Commerce endpoint tests pass.
  Product/panel, Offer and legacy reorderable-field regressions were also run.
  An Offer scenario and a legacy reorderable scenario timed out in combined
  runs; both files pass when rerun separately. Combined-run timeouts are
  recorded rather than silently counted as clean runs.

## Local Courtside verification

Only local Courtside was updated: 12 installed dashboards, targeted endpoint
input contracts in four sources, and three local function directories. Installed
metadata, credentials, source URLs and unrelated definitions were preserved.
The local runtime was restarted to load the changes.

Backup: `/tmp/cmscore-integration-views-backup-1788824201031` contains the original
installed definitions and local function directories. It is private because
source definitions may contain sensitive connection references.

The 12 affected dashboard entry pages load without page errors or unavailable
views. Real local browser flows created, edited, reloaded and deleted an owned
QA metadata definition and user field, and created, edited and archived an owned
QA email template. Edited controls retained their nodes; tested mobile pages
had no horizontal document overflow. The archived QA template was then removed
by its exact key/name/status from the local database. Structured user-field
options were also created, edited, reloaded and deleted against the local
endpoint, with both option values and their generated identities preserved.

Screenshots and detailed local results are under `/tmp/cmscore-local-*`; browser
fixture captures are under `/tmp/cmscore-all-views-*`. Screenshots establish the
tested layouts, not a claim of exhaustive pixel equality for every possible
integration resource or provider state. No production deployment or commit was
performed.
