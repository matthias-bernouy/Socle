# Integration view migration status

The current official integrations remain at `1.0.0`. Supported detail saves,
creation and operations use the [shared form contract](../../integrations/dashboard-views.md).
Product, Offer, Brand, Category and Seller migrations are included. The legacy
JSON action transport and response-to-resource mappings have been removed.

## Migrated scope

Beyond those earlier views, 22 detail views were fully or partially migrated:

| Integration | Views | Result |
| --- | --- | --- |
| Commerce | General settings, notifications, protected C2C policy, offer condition, custom metadata, workflow state and transition | Native Save; metadata deletion; creation through the detail where supported |
| Forms | Form, section, question, submission | Common form creation/Save with atomic metadata updates; publish/archive independent forms; section Save/Delete; question Save with stable references and structured image choices; submission review/archive |
| User Account | Account and extra field | Native Save/Delete; extra-field creation and native list reordering |
| Emailer | Template | Native Save/Create; independent test-email and archive forms |
| Mondial Relay | Shipment and settings | Independent shipment recovery; native settings Save |
| Commerce Negotiation | Settings and proposal | Native settings Save; independent cancellation form |
| Commerce Stripe Payments | Protected payment, claim, refund request, Stripe dispute, provider exception | Independent release/refund, resolution, review, evidence, accept and requeue forms |

Readonly details and GET downloads/navigation retain their existing contracts.
Mossa, Ulvia and the two Commerce Mondial Relay extensions have no detail forms
to migrate. Newsletter's subscription export remains a GET download.

## Native actions and retained binary transport

All official JSON mutations now use native Save/Delete/independent forms.
Forms child creation/deletion keeps its list buttons and navigates using returned
references. Delivery projection recovery submits exactly one checked row and
retries failed reads without repeating a mutation. Consent creation/publication
and Stripe Connect seller terms use native management forms; page resolution,
revision checks and immutable snapshots remain server responsibilities.

Only two endpoint actions remain, both binary downloads: Newsletter
subscription export and Commerce Stripe claim evidence. Their Blob/header
transport remains necessary. The general JSON action fallback (`sendSourceJson`), old management actions and
`after.resource` mappings have been removed. Validation rejects those declarations;
fixtures now exercise native forms. Multipart image uploads retain a small bound
file form, while downloads retain their Blob/header handling.

Publication verification covers creation of an inactive Consent policy, disabling,
resolved documents, conflicts, native page-picker form values and repeated save.
The browser checks retain field nodes and positions across a delayed publication.

## Final native-action cleanup verification

The cleanup passed 162 contract/component tests and 88 Control admin tests.
A further 31 browser regression tests passed across 25 files run in separate
processes: typed choices and empty arrays, lookups, schema failures and hidden
metadata, conditional fields, nested navigation, table CRUD and desktop/mobile
layouts. Native operation/publication coverage passed 13 tests together; the
image upload/replacement test timed out in that batch and passed in isolation.
A larger grouped browser run also stalled; isolated success does not establish
that the grouped test harness is reliable.

The final `check:all` passed 8/8, with zero UI-contract errors and 62 warnings
(previously 63). The remaining Dashboard network finding is the binary download
request. Directory fanout has no blocking errors. The PageLink native-form state
implementation remains one cohesive file despite its file-size advisory.

On local Courtside, real browser actions created a form, section and question,
saved and reread the question, deleted it, and returned to its parent. The saved
input retained its node and geometry; no browser errors occurred. The owned form
was deleted afterward. Consent, Stripe Connect and Delivery views were reread and
screenshots inspected. Legal publication mutations were covered with provider
and browser fixtures, without publishing a new real policy or contacting Stripe.
Local view snapshots and the Consent provider were updated; production was not
modified.

## Action lifecycle cleanup

The unused action callbacks (`reloadDefinitions`, `reloadCollection`,
`setDetailResource`, `clearDetail`, `render`) and the direct-resource mounting/cache
path are removed. Detail data comes from its binding source. A small action scope
retains only generation invalidation: late uploads/downloads cannot modify drafts
or emit notifications after navigation or disconnection. Concurrent uploads remain
independent; media draft restoration is retained.

Definitions refresh through their existing binding source, without an additional
promise queue or action-owned refresh API. Retained detail controls do not reread
or remount merely because their rendering context is reconciled.

`bun run test:browser:dashboards` provides a reproducible file-isolated command;
it reports failures without retries. The low-level grouped Chromium reload/shutdown
issue remains distinct from this execution strategy.

## Validation baseline

The action lifecycle cleanup passed 82 focused unit tests. Browser coverage ran
27 files in isolated processes: 26 passed initially; the remaining creation
fixture used an empty string where the current Forms contract requires a null
identity. After correcting that fixture and its returned identity type, all
seven tests in that file passed (79 distinct browser tests overall). Coverage
includes independent actions, media, creation, Save, linked detail panels and
retained control geometry. Local settled reads of Consent, Stripe Connect and
Delivery reported no read errors and produced screenshots. The build and
`check:all` passed; 62 UI-contract warnings remain. This does not resolve the
separate timeout observed when running browser files together in one process.

The Forms follow-up passed 98 dashboard/parsing/provider tests, PostgreSQL
transaction assertions for settings preservation, and the real local
create/save/rename/reorder/delete flow. Owned local test records were removed.
Browser coverage includes typed choices, false booleans, image upload and
replacement, rejected replacement, choice removal, delayed Save, rejected Save,
failed reread/retry, desktop/mobile screenshots and stable control geometry.
The combined browser run passed 34 of 35 tests; a navigation test timed out.
All three navigation tests passed in isolation afterward. Keep this grouped-run
instability visible rather than reporting a fully green browser batch.
That baseline had `check:all` at 8/8 with 63 UI-contract warnings. The Forms endpoint
JSON stays grouped as one cohesive declaration despite the file-size advisory.


The migration was checked with 38 new browser tests using resolved official
definitions and the real admin bundle: all 22 views, six creations, four
deletions, two Emailer operations, delayed/conflicting Save, confirmation,
readonly URLs and structured allowed values. Source-overlay, input reset and
endpoint tests supplement these flows.

Local verification covered the 12 affected dashboard entry pages and real
create/edit/reload/delete flows for owned metadata and user fields, including
allowed values. An owned email template was created, edited and archived.
Test data were cleaned. Screenshots covered desktop/mobile layouts; normal
edit saves retained controls. Provider payments, refunds, shipping and email
operations used mocks rather than live credentials.

`check:all` passed at the migration handoff. The broader resource suite still
has unrelated baseline findings: the combined-installation test supplies old
installation answers, and two management definition fragments exceed the
bundle test's line limit. These do not establish an all-green integration suite.
Grouped Offer/reorderable browser runs also had timeouts whose isolated reruns
passed. Keep that distinction when assessing the evidence.

For ongoing verification, use the [binding checklist](../dashboard-widget-binding.md).
Historical step reports and temporary local artifact paths are intentionally
not maintained as current documentation; their contents remain in Git history.
