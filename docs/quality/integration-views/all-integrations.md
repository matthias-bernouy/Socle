# Integration view migration status

The current official integrations remain at `1.0.0`. Supported detail saves,
creation and operations use the [shared form contract](../../integrations/dashboard-views.md).
Product, Offer, Brand, Category and Seller migrations are included. The legacy
runtime remains required by the consumers listed below.

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

## Deferred work and reasons

| Case | Why a direct migration is unsafe | Required follow-up |
| --- | --- | --- |
| Consent details and Stripe Connect seller terms | These call integration management actions, rather than source form endpoints. Publishing also owns immutable legal snapshots | Migrate legal actions to independent native forms while preserving publication semantics; the settings target is now standardized separately |

No official dashboard action still submits a structured body through `sendSourceJson`.
Forms child creation/deletion and Mondial Relay projection recovery now use native
independent forms. Forms keeps its list buttons and navigates using the returned
reference. Delivery submits exactly one checked row and retries a failed read
without repeating the completed mutation. Consent and Stripe Connect legal actions
still use management transport; binary downloads remain independent. Generic
legacy definitions and examples still accept endpoint bodies.

The old action runtime cannot yet be deleted. An empty legacy-source-action list
alone does not prove a migration is complete: integration management actions
must also be inventoried.

## Validation baseline

The Forms follow-up passed 98 dashboard/parsing/provider tests, PostgreSQL
transaction assertions for settings preservation, and the real local
create/save/rename/reorder/delete flow. Owned local test records were removed.
Browser coverage includes typed choices, false booleans, image upload and
replacement, rejected replacement, choice removal, delayed Save, rejected Save,
failed reread/retry, desktop/mobile screenshots and stable control geometry.
The combined browser run passed 34 of 35 tests; a navigation test timed out.
All three navigation tests passed in isolation afterward. Keep this grouped-run
instability visible rather than reporting a fully green browser batch.
`check:all` remains 8/8 with 63 existing UI-contract warnings. The Forms endpoint
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
