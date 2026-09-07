# Dashboard widget binding refactor

Status: in progress. This document tracks the full refactor; intermediate green
checks are not completion evidence. The starting revision is `b91be35c7`.

## Contract

Use the document binding engine to apply resource data to light-DOM templates.
Visual elements retain encapsulated CSS and local interactions. Remove the
widget data-to-DOM renderers and JSON/event handoffs replaced by this work.
Preserve appearance, behavior, drafts, focus, selection and scrolling. Do not add
`cms-use`, template references, or repeat keys. Do not modify production.

A dashboard definition still describes which fields, sections and operations
exist. Composition must happen before source compilation. Response data must be
applied by binding to that composed HTML, not used to reconstruct a widget tree.

## Starting evidence

- Baseline `bun run check:all`: 8 passed, 0 failed.
- UI contracts: 0 errors, 77 warnings, 11 informational findings.
- Local inventory: 12 source groups, 22 dashboards; 28 tables, 35 details,
  2 tab groups, 5 navigation lists and 76 declared actions.
- Field inventory includes text, select, textarea, number, readonly, checkbox,
  tokens, combobox, media, money, schema, embedded tables, reorderable lists and
  page links. There are 17 conditional fields and 6 remote-search fields.
- Sections, secret references, CMS-user controls and remote pagination also need
  explicit fixtures; absence from the current site is not permission to drop them.
- Existing consumers: Sources, integration settings, the operator workspace,
  dashboard examples, relation projections and nested detail navigation.
- Evidence directory: `/tmp/cmscore-widget-binding-20260907/`. Initial browser
  captures include desktop/mobile screens and per-request timings. Preserve the
  initial bundle there for comparable browser fixtures.

## Required verification matrix

| Family | Required evidence | Status |
|---|---|---|
| Composition | Recursive sections/tabs, each widget, definition changes, light-DOM ownership | Pending |
| Navigation | Sources/settings/operator, direct links, back, browser history, tabs | Pending |
| Lists | Filters/search, selection, bulk actions, reordering, pagination where offered | Pending |
| Details | Create/edit, validation, repeated save, confirmation/cancel, persisted reload | Pending |
| Dynamic controls | Conditional fields, lookups, relations, schemas, pages, secrets, CMS users | Pending |
| Collections | Embedded tables, reorderable rows/cards, derived values | Embedded tables and reorderable rows/cards use binding and have route-fixture coverage; manual renderer removal and final coverage audit pending |
| Media | Upload/replace/remove/reorder/download, real file payload checks | Pending |
| Concurrency | Delays, errors/retry, double actions, stale/out-of-order/cancelled requests | Pending |
| UI stability | Long forms, active edits, focus/caret/selection, drafts, scroll/nav position | Pending |
| Visual fidelity | Same data/state desktop/mobile before/after, image inspection, overflow | Pending |
| Authorization | Operator scope, forbidden endpoints, local vs simulated providers | Pending |
| Final gates | Format/diff review, build, scoped suites, final check:all, served bundle, commits | Pending |

## Implementation checkpoints

1. Replace the resource-driven detail renderer on a complete list/edit/save flow.
2. Extend binding templates to every field/widget and remove obsolete paths.
3. Complete the matrix, compare timings and visuals, and validate the local runtime.

Do not mark this work complete while any row remains pending or while old render
paths remain as an undocumented fallback. Tests using controlled routes must be
reported separately from real local persistence checks.

## First implementation checkpoint

Basic text, number, textarea, select, page-link and secret-reference detail
controls now have declarations composed before source activation. Their source
is the detail host; visible values bind directly to light-DOM controls. Static
control markup lives in `sources/_runtime/detail/controls.html`. The visual
field wrapper owns only its label/layout CSS and a slot.

The binding-owned source-value interface seeds creation forms and applies
completed action resources without a second request or widget DOM reconstruction.
Unchanged interpolated attributes are not written again, preserving local input
state when other response fields change. Four focused engine tests cover initial
values, null/empty state, stale request cancellation and unchanged input drafts.

The complete existing list/filter/error/retry/edit/save/browser-scroll scenario
passes on this path. It now also asserts that field controls are in the document
light DOM and there is no detail data-relay element. The first Commerce settings
captures were inspected against the initial desktop/mobile appearance.

This is not the final architecture audit: complex controls, conditional fields,
read-only array formatting, metadata navigation and the old compatibility paths
still needed migration at this checkpoint. `supportsBoundDetail` is an explicit temporary migration
boundary and must disappear before final completion. The work must also remove
the remaining response-to-widget render calls, including manual example paths.

## Read-only fields checkpoint

Read-only scalar values, lists, empty lists, badges, dates, money and images now
use declared light-DOM branches and repetitions. Formatting uses pure value
filters and the same existing formatting functions; filters do not construct
HTML. Image URLs use the existing document image activation runtime.

A minimal regression test demonstrated that existing conditions could not
distinguish a scalar from an array. Conditions now accept one registered filter
with an optional argument path, using the interpolation filter registry and
ordinary comparison/boolean precedence. Unknown filters fail closed. This does
not introduce JavaScript evaluation, general parentheses, filter chains, template
references or repeat keys. The previously unsupported parenthesized fallback
title was replaced with an equivalent supported expression.

The Chromium read-only fixture compares the initial bundle and the current
bundle at 1440×1000 and 390×844, with the admin stylesheet. Both load one detail
response and one image. Captures are in the evidence directory under
`readonly-styled/`; desktop/mobile images were inspected. Geometry differs by
less than two pixels; mobile pixels match exactly, with a small desktop
difference confined to the rounded image border. These are controlled fixtures,
not local persistence tests. Single-run load timings are recorded but are not
enough to claim a speed improvement.

The same fixture holds a refresh response and checks five animation frames:
image/navigation positions, nonzero content-panel scroll and the edited title
remain stable. After release, focus and text selection are retained. Unit tests
also cover scalar/list transitions, blank values, currency fallback, image
bindings and fallback titles. Chromium verifies the actual image request and
decoded pixels; the DOM-only test checks the inert URL binding.

The automatic-source value API now rejects form-owned submission triggers and
does not abort successfully completed reads. Those boundaries have dedicated
tests. Complex controls, visibility/draft scopes, navigation and the remaining
widget renderers are still pending; the overall verification matrix is not
complete. In particular, retaining a draft when a refresh fails after a
successful initial load still requires its own regression test and review.

The read-only local crawl opened the first selectable record where available
on each of the 22 dashboards, using both bundles, without writing data. It found
no JavaScript errors or document overflow at 390px. Four detail screens used
the new renderer at this checkpoint: Commerce configuration, sellers, workflow,
and Stripe Connect seller terms. Their desktop/mobile captures match the initial
bundle pixel-for-pixel. Evidence is under `readonly-live/` and
`readonly-live.log`. This does not imply that all fields on all dashboards have
been migrated or that the corresponding write flows have been tested locally.

Five controlled read-only runs measured an initial-load median of 200.2ms before
and 178.9ms after (ranges 195.0–200.8ms and 174.4–186.6ms). Both make one detail
read and one image request; the test's explicit refresh adds one later read.
Both still request dashboard definitions twice. These local mocked-route
measurements do not establish service latency or a general performance gain.

Static combobox and token fields also use the declared controls. Their Chromium
flow selects an option, removes a required token, checks the blocked save, adds
a predefined and a custom token, saves, reloads, removes a token, saves again
and reloads. The controlled endpoint records arrays rather than serialized
strings. The DOM tests verify that an unchanged server value does not overwrite
the edited choice. Remote lookups remain outside this checkpoint.

Checkpoint validation: build passed, 377 scoped tests passed, and all eight
`check:all` gates passed. UI-contract counts remain at the initial 0 errors,
77 warnings and 11 informational findings. `Source.ts` now has 186 lines; its
request lifecycle remains cohesive, so it was not split solely to suppress the
size warning. `WDetail` still includes the temporary legacy branch and must
shrink when that path is removed.

All seven dashboard browser scenarios pass when run in separate Bun processes.
The grouped run repeatedly stalls in the existing table-layout test before
navigation finishes; the same three-test sequence also fails using the initial
bundle and original test timeouts. Evidence: `table-layout-baseline-original.log`,
`browser-suite-repeat.log` and `isolated-*.log`. Diagnostic instrumentation was
removed. No timeout was increased. This pre-existing grouped-run failure is
reported separately from the successful isolated browser checks.

## Navigation-list checkpoint

Navigation lists no longer accept a JSON configuration attribute or an object
configuration method. Their actions are declared in light DOM from the dashboard
definition, before source activation, using the static navigation-list fragment.
Rows continue to use the document source and repeat. The visual component keeps
its encapsulated appearance, empty-state detection and drag interactions.

The new Chromium flow exposed and fixed two functional problems: dragging tried
to move a source-owned row into the wrong parent, and a successful collection
mutation retained stale rows without refreshing their source. Successful
collection mutations now trigger only that widget's binding reload event. A
separate regression test checks that navigating away during a mutation does not
refresh the newly selected screen. The detail back button also needed composed
path matching after its listener moved to the light-DOM host.

The controlled browser flow covers an intentionally delayed reorder, its exact
request payload, one subsequent collection read, stable list geometry during
and after the request, saved order after a full reload, detail opening/back,
confirmation cancellation, confirmed clearing and opening an empty creation
form. It checks document ownership of the action controls and JavaScript errors.
This fixture persists data in its route handler, not in the real local database;
creation/save, failed reordering and overlapping reorder operations still need
additional coverage before the full matrix is complete.

Inspected desktop/mobile before-and-after screenshots are pixel-identical at
1440×1000 and 390×844. The baseline is the preceding implementation checkpoint;
its navigation rendering was unchanged from the goal's starting revision.
Evidence: `navigation-captures/`, `navigation-comparison.log`,
`navigation-unit.log` and `navigation-scoped.log` in the evidence directory.

Validation: build passed, 132 dashboard/widget tests passed, all eight dashboard
browser files passed individually, and all eight check:all gates passed. UI
contract counts remain 0 errors, 77 warnings and 11 informational findings.
The browser dashboard directory now has eight entries, an informational fanout
finding; its two fixture directories group their respective browser scenarios.
There are no new blocking findings. The full scope remains in progress and the
local runtime still needs final bundle activation and verification.

## Checkbox and amount checkpoint

Native checkbox values now bind directly through `cms-bind-value`, using strict
boolean values. The binding compiler accepts this existing attribute on native
checkboxes, and its value site updates only their checked property. Other native
elements do not become arbitrary property receivers. Unchanged boolean values
are not reapplied, preserving a local toggle during an unrelated refresh. This
keeps the existing native checkbox appearance and avoids HTML's presence-based
`checked="false"` behavior. Engine tests cover initial false, local edits,
subsequent true/false changes, missing values and non-boolean inputs.

Money inputs now use the static amount-control template, the official input,
and pure formatting filters backed by the existing minor-unit conversion and
currency precision functions. Existing parsing and validation still produce
integer minor units for actions. Conditional decimal rules remain part of the
pending visibility/draft-scope migration, not a completed path.

The controlled Chromium scenario checks initial true/false checkboxes, required
checkbox validation, decimal precision errors, comma decimal input, integer-only
amounts, a zero-decimal currency, zero values, two saves and full reloads. It
verifies exact boolean/integer payloads and no redundant detail read after a
save with a returned resource. During a held refresh it preserves an edited
checkbox, the amount draft, focus and text selection. All field controls are in
the document light DOM. This is route-handler persistence, not a real local
service write.

Initial desktop/mobile screenshots match the goal's original bundle
pixel-for-pixel, with equal control positions and no document overflow. Captures
were inspected under `scalars-captures/`. Five controlled runs recorded median
initial loads of 185.5ms before and 163.9ms after (ranges 181.7–187.8ms and
163.3–191.5ms), with one detail read in each case. The first save's median was
45.6ms, with one write and no additional read. These mocked-route measurements
do not establish production performance. Logs and measurements are in
`scalars-run-*.log` and `scalars-timings.json`.

Validation for this checkpoint: 248 binding tests and 132 dashboard/widget tests
passed; all nine dashboard browser files passed individually. Build and all eight
check:all gates passed. UI-contract counts remain unchanged. The full verification
matrix and final local-runtime activation remain incomplete.

## Conditional fields and draft context checkpoint

Automatic sources can now derive additional local scope variables through
`setSourceContext` and reevaluate them with `refreshSourceContext`. The existing
source renderer applies the scope to its authored template. Local refreshes do
not fetch, cancel pending reads or publish new source states; source aliases and
status variables take precedence over context variables. Tests cover local
conditions, unchanged input drafts/focus/caret, disposal and a pending read.

Detail definitions now declare field visibility through `cms-condition` and a
pure filter using the existing dashboard visibility evaluator. The context
projects original resource values and local edits, including field-id/path
mapping and conditional money precision. It never constructs HTML or delivers
a response object to a widget renderer. Hidden field drafts survive removal and
reappearance. Conditional actions, complex controls and nested widget composition
still require migration; `supportsBoundDetail` remains temporary.

Save handling now acknowledges the submitted snapshot without deleting newer
edits. Acknowledged local values are released when the returned/reloaded resource
arrives, allowing server normalization to appear. Raw amount drafts remain
available while a save or read is pending. The E2E exposed a separate settings
bug: resource reconciliation compared an empty row identifier with undefined,
so standalone details ignored returned save resources. Their empty selection is
now normalized consistently.

The controlled flow covers nested all/any conditions using fields and resource
properties, hidden required fields, hide/show draft retention, dynamic decimal
precision, normalized saves and full reloads. It then holds another save, edits
text and a comma-decimal amount during that request, and verifies the newer
drafts, focus, caret and detail geometry after completion. A subsequent failed
read and successful retry retain those drafts; a final save/reload verifies the
newer values were persisted by the fixture. Separate action tests check failed
saves and preservation of newer/unrelated draft entries.

Desktop/mobile captures for hidden, visible and invalid field states match the
original goal bundle pixel-for-pixel. Focus targets are explicitly equalized
and animations are disabled for image comparison. Images were inspected under
`conditions-captures/`; geometry checks cover every visible control and document
overflow. Both implementations make one initial detail read and no extra reads
when changing conditions. Five runs using frame-based readiness checks measured
median loads of 198.2ms before and 184.2ms after (ranges 180.6–220.2ms and
175.9–205.7ms). Evidence: `conditions-visual-*.log` and
`conditions-timings.json`. These controlled routes do not establish real-service
latency or local database persistence.

Validation: 250 binding tests, 134 dashboard/widget tests and all eleven browser
files passed (browser files individually). Build and all eight check:all gates
passed; UI contracts remain at 0 errors, 77 warnings and 11 informational findings.
The source/event lifecycle files remain cohesive above the size-review threshold.
`WDetail` and `fieldState` still contain legacy responsibilities pending removal;
their larger interim size is tracked rather than hidden by mechanical splits.
The full scope, real local write flows and final runtime activation remain open.

## Conditional detail actions checkpoint

Detail buttons and overflow menus now use the static `detail/actions.html`
fragment. Binding repeats apply the primary actions, section groups and menu
items, including their labels, tones, confirmations and four supported icons.
A data-only scope projection evaluates existing visibility rules and keeps the
original layout policy: the first three visible non-menu actions are buttons;
remaining actions precede explicit menu actions, grouped in first-seen order.
Conditional actions no longer force a detail onto its legacy renderer. The
legacy action helper still serves unmigrated detail families and must eventually
be removed with those families.

Unchanged repeated entries in the same order now update their existing regions
with the current item/parent scope. There is no key attribute, item matching or
reconciliation of changed lists. Repeats with a root condition still follow the
existing rebuild path. A focused engine test first failed on the previous
implementation, then passed with input draft, selection and focus preserved
while item and parent text changed. Stable action groups use this behavior to
keep focused menu items during unrelated source refreshes.

The controlled browser flow covers button promotion, two overflow groups, four
icons, Escape, cancel/accept confirmations, exact action payloads, normalized
save results and fixture persistence after full reload. During a held read it
checks the open menu, focused item, menu/detail/secondary-navigation geometry
across five animation frames and again after completion. All thirteen dashboard
browser files pass individually. These writes use route fixtures, not the local
database.

Desktop/mobile basic/open-menu captures are pixel-identical to the original goal
bundle. Image inspection found a 20px menu-width regression before correction:
the detail's shadow CSS now also targets its slotted menu. Panel geometry is
included in the comparison. Evidence: `actions-captures/`,
`actions-visual-*.log`, `actions-timings.json`. Five sequential controlled runs
recorded median initial loads of 200.6ms before and 185.6ms after (ranges
194.6–204.3ms and 183.9–201.4ms), with one detail read and no read when toggling
visibility. These numbers are not real-service performance measurements.

The advanced mobile reference already shifts its content horizontally when the
wide action row is brought into view. The migrated rendering matches this
behavior; a document scroll-width assertion does not detect that internal
clipping. This remains an explicit UI-stability issue for the full audit, not a
claim that all overflow is resolved.

Validation: 251 binding tests, 134 dashboard/widget tests, 45 additional detail
tests and all thirteen browser files pass. Build and all eight check:all gates
pass; UI contracts remain at 0 errors, 77 warnings and 11 informational findings.
The resumed initial check caught unformatted in-progress repeat changes and
bundle drift, both resolved by formatting/building. The earlier action-start
baseline passed all eight gates. The binding site file (192 lines) and repeat
suite (181 lines) remain cohesive despite crossing the size review threshold;
the detail binding directory has eight entries (informational, not blocking).
Complex widgets, nested composition, real local writes and final runtime
activation remain incomplete, as does the full matrix above.

## Nested detail navigation checkpoint

A navigation list inside a supported detail no longer forces the whole detail
onto its legacy renderer. The mounting layer composes the light-DOM declarations
in their original order and with the owning selection context before source
activation. `DashboardWDetail.configure` no longer constructs that markup.
Sections and tabs continue to compose their definitions before their child
sources activate; the browser fixture exercises a section containing tabs, a
detail with a navigation list between two field sections, and another nested
section/detail in the second tab. No new template-reference mechanism is used.

Independent child reads remain parallel with the parent read. The child's
binding declaration interpolates `data-detail-ready`; the detail's encapsulated
slot styling hides that child until the parent has data. A condition that
unmounted the child would serialize the reads, so the test deliberately holds
the parent and requires the child response before releasing it. The title is
also absent during initial loading, matching the original renderer.

Source retries are delegated from the stable dashboard host to the closest
source. This replaces listeners attached to composed nodes that binding can
clone, and prevents a nested retry from also reloading its parent. Detail action
handling ignores actions owned by nested widgets, so the parent neither runs
child actions twice nor applies its own required-field validation to them.

The controlled flow verifies initial loading, tab changes retaining edits,
normalized parent and child saves, exact write payloads and fixture persistence
through full reloads, browser back/forward, the UI back action, direct selection
URLs, owning-context parameters, drag ordering and cancel/accept confirmations.
A failed child read and retry leave the parent alone. During a held parent
refresh, five frame samples preserve the scrolled list and secondary navigation
geometry and the textarea draft; focus and selection survive completion, with
no new child read. Confirmed clearing issues one write and remains empty after
reload. These are route-fixture writes, not local database persistence.

Six comparable captures (edit tab, information tab and initial loading, each at
1440px and 390px) match the original goal bundle pixel-for-pixel; images were
inspected. Geometry comparisons identify controls by field/widget identity,
since light-DOM migration changes DOM traversal order without changing their
positions. Evidence: `nested-captures/`, `nested-visual-*.log` and
`nested-timings.json`. Five sequential controlled runs measured median initial
readiness of 195.7ms before and 184.9ms after (ranges 181.9–199.1ms and
176.6–188.4ms). Each source is read once; visiting and revisiting tabs adds no
duplicate reads. These measurements do not establish real-service latency.

Validation: all 179 dashboard/widget/detail tests and all fifteen dashboard
browser files pass individually; the nested visual file has two scenarios.
Build and all eight initial/final check:all gates pass, with unchanged UI-contract
counts. The existing detail event file remains cohesive above the size-review
threshold. Complex controls, table metadata/configuration, definition/navigation
relays, examples, real local writes and final runtime activation remain open.
The complete verification matrix is still pending.

## Table composition checkpoint

`DashboardWTable` no longer accepts object configurations, row data or JSON
attributes. Its obsolete row/configuration renderer, types and unused mapping
module are removed. The mounting layer composes headers, actions and filters
from the dashboard definition before the table host's source activates. Rows
continue to use binding repeats. Relation tables and the example table use the
same composition path. Applied filter values are local binding context, not
values imperatively reapplied by the visual table component.

The original native filter inputs/selects and real HTML form remain in light
DOM, including Enter submission. Their previous CSS is encapsulated by small
visual filter wrappers; composition injects no global stylesheet. Table action
buttons remain the official button component. The table shell retains local
checkbox selection, confirmation and form events. This preserves existing
native filter behavior and appearance rather than replacing its controls as
part of an internal refactor.

`cms-bind-value` now supports native text/search inputs, single selects and
textareas, in addition to checkboxes and typed custom-element receivers. It
avoids writing an unchanged applied value, preserving local drafts and caret.
File inputs and multiple selects are deliberately outside that scalar contract.
An explicitly seeded automatic source without a URL can activate through the
ordinary binding registry; unseeded URL-less sources remain inactive. The
example uses this path without a fabricated endpoint. Registry unit coverage
checks local updates, transition to a network read and disposal after removing
the URL; Chromium independently verifies automatic discovery, network rendering
and registry disposal. This browser check covers mutation delivery rather than
relying on the DOM emulator's observer behavior.

The controlled E2E flow covers native filter submission/clearing, select-all,
slow and out-of-order reads, a failed read/retry, CSV filename and bytes,
normalized edit/create payloads, required validation, fixture persistence after
full reloads and cancellation/acceptance of clearing. Five frame samples during
a held response preserve filter/navigation geometry and the new input draft;
focus and text selection survive completion. The example also covers selection,
back navigation and absence of source API reads. These are route fixtures, not
real local database persistence.

Four comparable desktop/mobile captures (all rows and active filter) match the
original goal bundle pixel-for-pixel and were inspected. The mobile reference
already clips a long table action row; preserving those pixels does not prove
that all existing internal overflow is fixed. This joins the previously noted
detail action-row clipping in the outstanding full UI audit. The dedicated
wide-table test verifies horizontal scrolling stays inside the table frame.
Evidence: `table-captures/`, `table-visual-*.log`, `table-timings.json` and
`table-browser/` under the evidence directory. Five sequential controlled runs
measured median initial readiness of 171.2ms before and 157.4ms after (ranges
165.9–194.6ms and 153.8–166.1ms). The full four-state capture sequence makes four
table reads in either version; these are not real-service latency measurements.

Validation: 253 binding tests, 178 dashboard/widget/detail tests and all eighteen
dashboard browser files pass individually. One obsolete mapper-only test was
removed with its unused implementation. Build and final check:all pass all
eight gates, with unchanged UI-contract totals (0 errors, 77 warnings, 11
informational findings). The initial table check passed all eight; the resumed
check caught only formatting in the unfinished example test, now resolved.
The binding site file remains cohesive at 201 lines; mounting now has eight
entries, an informational directory finding. Complex detail controls,
definition/navigation relays, the example detail, real local writes and final
runtime activation remain incomplete. The overall matrix remains pending.

## Remote field lookups checkpoint

Top-level combobox and token lookup fields now compose a light-DOM source with
ordinary option repeats. They no longer require the detail's old lookup loader
or response-to-DOM option reconstruction. The detail projects dependency URLs;
`cms-dashboard-lookup` keeps only query, offset and accumulated option data. It
changes its source URL for interactions and projects successful source data into
binding context. It does not fetch, inject CSS, accept a JSON configuration or
construct rendered options after a response. The option and source-state
markup is in `sources/_runtime/detail/lookup.html`.

Definitions declare mapping paths and query parameter names as scalar
attributes. Declared static options, selected resource labels and newly created
options join fetched pages in a data-only projection, with the original value
precedence. Unresolved dependencies use a locally seeded empty source; changing
the dependency activates its network URL without rebuilding the control.
Cross-source URLs retain the operator route prefix. Empty literal parameters
do not block readiness, and search/offset parameters preserve the existing
request contract. Page accumulation and query debouncing remain necessary local
interaction state; the binding source owns reads, cancellation and rendering.

The official combobox accepts explicit `loading="false"` and `has-more="false"`
values for binding interpolation, while retaining the existing presence form.
Changing those status flags updates the option list without reapplying the
selected value. A focused component test checks an open query, caret and focus
through the loading/pagination transitions. No new binding directive or private
binding core was introduced.

Browser coverage includes selected labels outside the fetched page, remote
search, next-page accumulation, typed token arrays, missing dependencies,
dependency clearing, normalized inline creation and saving returned identifiers.
Save payloads and values after full reloads are checked against route-fixture
persistence. Slow responses preserve field/navigation geometry over five
frames, input focus, selection and an unrelated draft. Out-of-order replies
cannot replace the latest search; a failed search retries the same query.
An additional failing test exposed a next-page retry bug in the new controller:
its retry now reissues the same offset, and two immediate pagination clicks
produce one request. These tests do not establish real local database writes.

Four desktop/mobile closed/open captures were inspected and their field
geometry matches the original goal bundle. The latest desktop images match
pixel-for-pixel; mobile differences are 25 pixels closed and 3 pixels open,
confined to control corners. Five sequential controlled runs measured desktop
median readiness of 182.3ms before and 194.7ms after (ranges 169.2–200.8ms and
182.7–203.3ms); mobile medians were 182.9ms and 193.5ms (ranges 168.3–185.9ms and
189.3–207.7ms). This sample is modestly slower and is not evidence of a speedup.
Each run performs one lookup read. These are fixture/bundle measurements, not
provider or local-service latency. Evidence: `lookup-captures/`,
`lookup-timings.json`, `lookup-visual-*.log`, `lookup-browser/` and the dedicated
`lookup-pagination*.log` files in the evidence directory.

Validation: 265 binding/combobox tests and 180 dashboard/widget/detail tests
pass. All 23 previously present dashboard browser files passed individually;
the added pagination file also passes, bringing the inventory to 24. Build and
initial/final check:all pass all eight gates, with UI contracts unchanged at
0 errors, 77 warnings and 11 informational findings. The detail widget and
browser detail-binding directories now have eight entries (informational).
Existing cohesive combobox, detail event and detail host files remain above the
size-review threshold; no new handwritten file exceeds it.

The old lookup code is still needed by unmigrated complex details, including
CMS-user controls and lookups nested in editable collections. It must be removed
as those controls migrate. Schemas, media, collection controls, metadata relays,
real local persistence and final runtime activation remain outstanding. This
checkpoint does not complete the goal or the full verification matrix.

## Shared CMS-user directory checkpoint

Top-level CMS-user fields now use light-DOM comboboxes and option repeats from
`sources/_runtime/detail/users.html`. A single hidden `cms-dashboard-directory`
source fetches `/api/users` lazily when at least one user field becomes visible.
Its controller announces lifecycle changes without transporting the response;
the owner projects options from the binding's source cache. Several controls
share that read, and hiding/revealing them retains the successful directory.
The existing mapping preserves opaque subjects, user labels and unknown-user
fallbacks. Before a successful read, an unresolved selected subject retains its
raw label, including during an initial directory failure.

The binding now supports `cms-bind-boolean-<attribute>` for strict-boolean
presence, required for the existing combobox's `invalid` contract: a string
`invalid="false"` still marks it invalid. Focused tests cover true/false and
nonboolean values, nested source and submit-result ownership, and local
validation feedback. Interpolated attributes and presence bindings retain the
last applied result, so an unrelated context refresh does not erase a local
required-field message. A changed bound result still applies. The contract is
documented in `docs/blocs/data-bindings.md`; no private core or template/key
mechanism was added.

Browser scenarios cover a shared lazy read, conditional hide/reveal, required
validation, exact subject save payloads, server normalization and full reloads.
A held directory response preserves a long-form draft, focus, text selection,
scroll and navigation geometry over five frames. Another scenario preserves
an open user search and its text selection when options arrive. Failure then
focus/click retry performs one new read and clears the error state. Persistence
is provided by controlled browser routes, not a real local database. The common
detail fixture now declares UTF-8 so its Unicode user labels match the actual
admin document instead of being decoded using a legacy browser encoding.

Desktop/mobile loaded/error screenshots retain identical field geometry and
were inspected against the original goal bundle. Three latest pairs are pixel
identical; the desktop loaded pair differs by 22 pixels at rounded control
corners. Five sequential fixture runs measured median loaded readiness of
189.3ms before / 198.5ms after on desktop (ranges 182.8–210.9 / 181.1–201.9ms)
and 183.4 / 193.6ms on mobile (164.2–186.4 / 171.5–207.1ms). Error-state medians
were 163.3 / 172.9ms desktop and 159.6 / 160.7ms mobile. Every run made one
directory request. These measurements show a modest readiness increase, not a
speedup or a measurement of local-service latency. Evidence is in
`cms-user-captures/`, `cms-user-timings.json`, `cms-user-visual-*.log` and
`cms-user-browser/` under the shared evidence directory.

Validation includes 256 binding tests, 180 Control dashboard/widget/detail
tests, all 27 dashboard browser files run individually, and the additional
open-query stability test (29 browser tests in total). The build passes.
Initial and final check:all pass all eight gates; UI contracts remain at
0 errors, 77 warnings and 11 informational findings, with no directory-fanout
errors. The attribute-binding test file is now 187 lines: it remains cohesive
around live text/attribute/value application, so the advisory size finding is
retained rather than creating another narrowly split test file.
The legacy CMS-user loader remains only for details with unmigrated complex
controls. Schemas, media, editable collections, metadata relays, real local
persistence and final runtime activation remain outstanding. This checkpoint
does not complete the goal.

## Media reference and lifecycle findings

The media migration now has a dedicated browser fixture in
`tests/browser/dashboards/detail-binding/media/`. It exercises a row-scoped
detail with actual browser file selection and multipart requests, backed by
controlled routes. Tests verify file names, MIME types and exact file contents;
upload, replacement, removal and ordering are reread after full reloads. A
multiple-file choice sends each file once and restores the five persisted
items. These checks establish fixture persistence only, not local-service
storage or a provider upload.

A failed upload reports the 503 error and leaves persisted media unchanged.
Reloading restores the three stored images; choosing the file again succeeds,
and another full reload retains it. This verifies recovery through an explicit
reload, not an inline retry or rollback of an optimistic tile.

Preview coverage includes opening originals, thumbnail selection, Home/End,
arrow wrapping, Escape/Close, focus restoration, broken images and single-image
navigation visibility. No preview interaction enters the file picker or writes
data. The test waits for the native dialog's asynchronous close cleanup before
asserting that the original image URL has been cleared.

Six desktop/mobile grid, preview and empty-state pairs were compared against
the original goal bundle. Geometry and pixels match exactly; the grid and
preview images were inspected. Captures and per-state readiness observations
are in `media-captures/` and `media-visual.log`. The code still uses the old
media renderer, so these are reference evidence, not proof of its migration.
The relocated read-only test and its stability helper pass from `readonly/`;
this grouping keeps the detail-binding directory at eight entries.

The executable `media/baseline.ts` deliberately reports observations instead of
claiming a passing stability test. Run it with `bun run` from the workspace root;
`CMS_MEDIA_BASELINE` optionally selects the preserved goal bundle. Both the
original bundle and the current bundle reproduce silent draft loss: typing
`Draft during the pending upload` while an upload is held leaves the input stable
for five frames, but completion restores `Saved notes`, loses focus and changes
the selection from `[2, 8]` to `[11, 11]`. Scroll remains 792px and the field and
navigation geometry remain identical. Thus screenshots alone miss this defect.
The observations are saved as `media-stability-before.json` and
`media-stability-current.json` in the evidence directory. Each scenario has one
media action and three detail reads: initial display, the action's resource
prefetch and its completion refresh. Single observations of response release
to normalized image display were 15.1ms and 14.8ms; they are not performance
comparison evidence.

Two source-backed constraints drive the next implementation. The grid's
`renderGrid()` and preview's `render()` still construct response-driven DOM and
must be replaced with document-visible binding templates. File selection,
object-URL ownership, drag interactions and native dialog focus handling remain
necessary interactions. `runDashboardMediaAction` also currently returns early
without a detail selection: standalone media actions need explicit coverage
and correction rather than being hidden by the row-scoped fixture. The legacy
detail refresh clears local state after an action; preserving unrelated drafts
and applying only the acknowledged media change is a required migration gate.

The five new media browser tests pass, alongside the relocated read-only test.
There are now 31 dashboard browser files containing 34 tests; the whole suite
was not rerun for this test-only checkpoint. Media rendering, failed-operation
inline recovery, concurrent mutations, real local persistence and the complete goal
remain unfinished.

Initial and final check:all pass all eight gates for this reference checkpoint.
UI-contract totals remain 0 errors, 77 warnings and 11 informational findings;
there are no directory-fanout errors. No production code or generated bundle
changed in this checkpoint.

## Bound media controls checkpoint

Top-level media controls now compose `sources/_runtime/detail/media.html` before
the detail source is compiled. Tile images, selected originals, captions,
counters and thumbnail repetitions stay in document light DOM. The page binding
applies their values; `cms-dashboard-media-field` has no response array setter,
JSON parser, fetcher or response-driven DOM builder. Its `items` getter reads
the rendered controls for form/action values. A transient interaction snapshot
keeps newly chosen files available until the field-change event records them.

The field, tile and thumbnail shells encapsulate their styles. Retained
imperative code handles file picking, multipart `File` objects, object URLs,
drag feedback, dialog/keyboard focus and native image load/error states. The
image observer watches bound native URL changes, so replacing an original while
the preview is open shows loading feedback without closing or losing focus.
It does not fetch or compose markup. Item projections are cached by input
reference so an unrelated draft update does not rebuild tile/thumbnail repeats.
No new binding directive, private core, template-reference or repeat key was
introduced.

Media actions now carry their originating widget and resource/field snapshot,
as operation input rather than a rendering relay. This enables standalone
details and avoids the redundant resource prefetch. Successful operations
acknowledge only their media field before refreshing. A browser test proves
that a note typed during a held upload preserves its value, focus, `[2, 8]`
selection, nonzero scroll and navigation/field geometry, then persists through
a separate save and full reload. It runs both selected and standalone details.
The initial read plus completion refresh total two detail reads instead of the
reference's three. Temporary file URLs are released after acknowledgement;
their owner is the detail, so an individual conditional control's lifetime
does not own the draft's URLs.

The action coordinator rejects stale completion effects. A test starts an
upload, navigates to another record and returns through browser history, then
types a new draft. Completing the old upload changes fixture persistence but
does not issue a new detail read, refresh the revisited UI or overwrite that
draft. The original multipart upload/replace/remove/reorder, multiple-file,
failed-upload/reload/retry and preview keyboard/error scenarios all pass.

All six desktop/mobile capture pairs retain identical geometry. Both preview
pairs are pixel identical; the latest grid/empty pairs differ by 49–75 pixels
around control/add-tile borders. Captures were inspected. Five sequential runs
measured these median readiness values (milliseconds):

| State | Desktop before / after | Mobile before / after |
|---|---:|---:|
| Grid | 204.3 / 196.0 | 174.8 / 192.6 |
| Preview | 239.3 / 244.5 | 230.2 / 247.8 |
| Empty | 159.3 / 181.8 | 156.5 / 177.8 |

Each state retains one detail read and respectively 3, 6 or 0 image requests.
Some initial states are modestly slower; these measurements do not establish
an overall speedup, and final performance review remains open. Raw ranges and
request counts are in `media-migration-timings.json`; captures are in
`media-migrated-captures/`, and the 33 individually executed browser logs are in
`media-migration-browser/`. All 37 browser tests and 180 Control tests pass.
Build and initial/final check:all pass all eight gates. UI contracts remain
0 errors, 77 warnings and 11 informational findings. The media browser directory
has eight entries (informational); no directory-fanout error was introduced.

The old media widget is now explicitly under `w-media-field/legacy/`, still used
by unmigrated complex details, reorderable controls and manual examples. It
must disappear with those consumers; it is not a completed compatibility layer.
Concurrent media mutations, inline rollback/retry, nested/conditional media
coverage, real local storage checks, schemas, editable collections, metadata
relays and final runtime activation remain outstanding. This checkpoint does
not complete the goal or its full verification matrix.

## Media failure recovery checkpoint

Failed top-level upload, replacement, removal and reorder operations now restore
only the submitted media field to its previous value. The action carries that
interaction snapshot; it is not a response-to-rendering relay. The field state
compares the failed submission with the current draft before restoring it, so a
newer same-field edit or cleared lifecycle is not overwritten. The view draft
receives the same guarded restoration. Unrelated edits stay untouched, and the
existing binding context applies the rollback without a detail GET or shell
reconstruction. The old nested media path remains pending migration.

One browser scenario exercises all four failures followed by an inline retry,
then a full reload to verify fixture persistence. It asserts the note draft,
focus, selection, original field geometry and unchanged navigation/scroll over
five subsequent frames. A second scenario hides/reveals a pending upload,
verifies that its blob remains readable, and finishes either successfully or
with an error while hidden. Both outcomes preserve another draft and release
the temporary URL exactly once. A focused field-state test checks rollback
against a newer edit and an already-cleared lifecycle.

An initial position assertion exposed a 2px grid-height change when adding the
fourth tile at a 1280px viewport. The original goal-baseline bundle and migrated
bundle both move the notes from y=567.5 to y=569.5. The test therefore checks
restoration to the original layout after rollback, rather than requiring the
pending extra-tile layout to survive its removal. This is an existing grid
border-sizing behavior, not a newly introduced reload jump. Observations are
in `media-layout-probe.log`; pending/error screenshots for all four operations
are in `media-recovery-captures/` and the error captures were inspected.

The resumed initial check caught a nullable URL in the new test; the explicit
URL precondition fixes its TypeScript error. The final check passes all eight
gates; UI contracts remain 0 errors, 77 warnings and 11 information. All 39
browser tests in 35 individually executed files pass (`media-recovery-browser/`),
as do 181 Control tests. The source build passed (`media-recovery-build.log`);
subsequent edits only corrected and extended tests. The 225-line field-state
file remains cohesive around draft/validation lifecycle; the added rollback
method does not justify a separate module. The 158-line media fixture is also
retained as one route fixture. There are no directory-fanout errors.

These are route-fixture persistence checks, not real local storage validation.
Concurrent media mutations, nested controls, schema migration, editable
collections, remaining legacy renderers and the full local-service matrix are
still outstanding. The goal remains incomplete.

## Dynamic schema browser reference

The schema family is still on the legacy detail renderer. New browser fixtures
establish its behavior before migration: numeric/string/enum/boolean controls,
required validation, metadata-based exclusions, unknown keys, explicit nulls
and absent optional values. The main flow performs two saves and full reloads,
checks the exact typed metadata object, and reveals an excluded field without
another schema request. The required boolean can validly be false; untouched
optional booleans stay absent. An unsafe `constructor` definition is omitted.

Lifecycle cases start with a missing category (no schema request), fail a schema
load, save other fields while preserving the existing metadata object, reload
successfully, and switch through an empty schema. Another case holds the padel
response, switches back to tennis and types a draft, then waits for the obsolete
fixture response to finish. Across five subsequent frames, obsolete controls
remain absent and the note, focus, selection and position remain stable. These
cases use browser route fixtures, not local database persistence.

The reference visual case compares ready/loading/empty/error states at 1440px
and 390px against the original goal bundle, plus the bottom of the mobile
scrolling pane. Geometry and mobile scroll match in all nine states. The
captures were inspected; seven final pairs are pixel identical and two empty
pairs have narrow input-border differences. The optional boolean incorrectly
shows a Required marker in both bundles: `checkboxLabel` passes undefined as
the force argument to `toggleAttribute`, which toggles the marker on. This is
a pre-existing presentation bug to fix during the schema migration, not a
required-state contract to preserve. Validation correctly treats it as optional.

Five sequential visual runs are in `schema-reference-visual-{0..4}.log`, with
observations in `schema-reference-timings.json` and images in
`schema-reference-captures/`. Ready-state medians for original/current bundles
are 199.1/182.2ms desktop and 176.3/178.6ms mobile; each state makes one detail
read and one schema request. These values establish a reference only: schemas
have not migrated, and they do not demonstrate an implementation speedup.

All four new schema browser cases pass, as does the scalar case moved into
`detail-binding/choices/` to keep directory fanout bounded. The earlier 39-case
browser suite passed before this test-only addition; the suite now contains 43
cases in 38 files. The final check passes all eight gates with unchanged UI
contract totals (0 errors, 77 warnings, 11 information) and no directory-fanout
errors. No source bundle changed after the media recovery checkpoint.

Next implementation: give schema declarations binding-owned sources, project
validated definitions and draft values into document-visible repeats and
conditions, and keep the visual grid/rows styled inside their component shells.
Preserve schema exclusion and validation contracts. Remove the corresponding
manual response renderer as consumers migrate. Delayed current responses,
drafts/focus during schema refresh, provider/operator endpoints and real local
persistence still require their full migration validation.

## Bound dynamic schemas checkpoint

Details whose controls are supported by the binding path now include schema
fields. The composition declares one hidden binding source per schema and the
static `sources/_runtime/detail/schema.html` template. The page core owns schema
requests, row repetitions, nested option repetitions, conditions and value
updates. `cms-dashboard-schema-source` only coordinates dependency debounce and
source lifecycle; it does not fetch or render definitions. Schema form reading
and validation consume the same source cache as the document projection.

Validated definitions retain the existing key/type/size limits. Pure row
projections keep their identity while ordinary values change, so the existing
repeat fast path updates active controls. There is no key directive or second
DOM renderer. Visual field/row shells encapsulate the grid, units and checkbox
styles; labels, inputs, selects, options and bindings remain in document light
DOM. Native light-DOM checkbox labels still toggle their inputs. Optional
checkboxes no longer incorrectly display Required; their validation and absent
value semantics are unchanged.

The seven schema browser cases now cover the reference save/error/dependency
flows plus source arrival during typing, detail refreshes, edits during a held
save, and conditional hiding/showing before and after source completion. They
assert draft values, focus/caret/selection, nonzero mobile scroll, field/nav
geometry and exact persisted fixture values after full reloads. Source arrival
preserves an existing note's focus and selection; inserting new schema rows can
naturally move that note, so that case does not claim unchanged field geometry.
Refresh/save cases assert it across multiple frames. Schema payloads containing
a normal `status` property remain valid data, not network-error markers.

A matching post-action resource exposed an initialization bug in the first
implementation: seeding undefined before activating the schema source caused
binding to treat it as supplied data and skip its GET. Only unresolved sources
are now seeded with an empty array. The existing direct-resource test now
asserts schema controls in light DOM, one schema/lookup/relation request and no
main-detail refetch. Its dormant main source remains attached for future
refreshes, consistent with other bound details.

The mobile save test also exposed the existing `p9r-select` popup positioning
bug: it always opened below a trigger near the viewport bottom, leaving Used
unclickable. The generic select now opens upward when needed, limits the list
height to available space and clamps horizontal positioning. The browser test
selects the previously unreachable option, checks panel bounds, resizes while
open and finishes the save. Before/after captures are `schema-select-before.png`
and `schema-select-after.png`; both were inspected. The field UI is unchanged.

All nine schema capture states retain reference geometry and mobile scroll.
Five final image pairs are pixel identical; three ready/bottom pairs differ
only in the removed optional Required marker (318 pixels each), and mobile
empty has 11 differing input-border pixels. Desktop/mobile ready, loading,
empty and error images were inspected. Five sequential runs are recorded in
`schema-migration-visual-{0..4}.log` and `schema-migration-timings.json`:

| State | Desktop before / after (ms) | Mobile before / after (ms) |
|---|---:|---:|
| Ready | 204.2 / 196.6 | 183.6 / 193.5 |
| Loading | 162.2 / 178.5 | 155.0 / 176.5 |
| Empty | 176.0 / 201.5 | 180.4 / 197.5 |
| Error | 179.0 / 204.8 | 167.2 / 204.7 |

Each initial state makes one detail read and one schema request. Several states
are slower; overall performance improvement is not established and remains a
final-review item. A separate five-run selected-detail save probe verifies both
rendered and fixture-persisted values. Click-to-save-response medians are
53.4ms before and 54.3ms after. The legacy path adds one schema GET per save;
the bound path retains the unchanged schema and adds none. Neither adds a main
detail GET. Raw data is in `schema-save-timings.json`. The original baseline
standalone probe emitted no save request, so that failed observation was kept
in `schema-save-unselected-before.log`; it is not included in comparable timing
results. Current standalone saves are covered by the passing browser flows.

All 46 dashboard browser tests in 40 independently executed files pass, as do
181 Control tests and three foundation select tests. Build and initial/final
check:all pass all eight gates. UI contracts remain 0 errors, 77 warnings and
11 information; no fanout error was introduced. Existing WDetail (284 lines)
and event-controller (233 lines) size warnings remain: the small schema wiring
belongs with their current responsibilities, and removing their legacy paths
is still outstanding. New schema modules remain below the size target.

The old schema control and loader remain for details containing unmigrated
editable tables/reorderable lists and for manual examples. They must disappear
with those consumers; this is not a permanent compatibility path. These tests
use route-fixture persistence. Complex/nested widgets, concurrent media writes,
operator/provider coverage, real local storage, metadata relays, the complete
E2E matrix and final runtime activation still prevent goal completion.


### Embedded table reference checkpoint

The next unmigrated family is the table field inside a detail, distinct from
the already bound top-level table widget. `detail-binding/collections/tables/` now has a
route fixture, a complete sequential save flow and desktop/mobile references.
Lookup tests moved under `detail-binding/choices/lookups/` to keep the directory
within its fanout limit; their behavior is unchanged.

The sequential browser flow exercises text, select, remote combobox and token
cells, removes the first row, edits the remaining nested values, adds a blank
row, saves and reloads, then adds another axis and saves/reloads its Cartesian
matrix. Assertions preserve hidden row metadata, readonly price/date source
values and row ordering. Blank rows are excluded from submission when all
editor values are empty. A select with a nonempty default makes a newly added
row nonempty; the fixture therefore explicitly provides a None option. These
saves use route-fixture persistence, not a local database.

Six screenshot pairs compare the original goal bundle with the current bundle
at this checkpoint: desktop 1440 and mobile 390, each ready, empty and waiting
for lookup options. All six pairs are pixel identical, with identical measured
field/row/navigation geometry. Images were inspected. The table field is still
on its old renderer in both bundles; this establishes a reference and does not
claim migration. Evidence is under `/tmp/cmscore-widget-binding-20260907/`:
`table-reference-captures/`, `table-reference-visual-{0..4}.log` and
`table-reference-timings.json`. Five-run initial-display medians are:

| State | Desktop original / current (ms) | Mobile original / current (ms) |
|---|---:|---:|
| Ready | 213.0 / 209.7 | 195.7 / 193.5 |
| Empty | 177.6 / 175.5 | 185.7 / 174.9 |
| Pending lookup | 176.3 / 188.9 | 185.8 / 186.1 |

Every observation makes one detail GET and one shared lookup GET, including
an empty table. These are reference measurements, not a performance gain.

A separate adversarial browser probe deliberately fails the required newer-
draft assertion: `table-concurrency-regression.test.ts` and its matching log
in the evidence directory. Resolving pending lookup options retains the edited
text but loses focus and changes selection from 2–7 to the end. Saving, then
editing a cell while the response is held, replaces the newer text with the
submitted text on response. All five sampled frames show the old value and
lost focus. This probe is not counted among passing tests and must become a
passing regression test during the binding migration.

Mobile images show columns outside the initial table viewport: the editable
table has 552px of content inside a 324px container. The matrix and readonly
table exceed their containers too. The reference checkpoint had not yet tested
horizontal scrolling, so those images alone do not establish inaccessible
columns. The migration checkpoint below verifies access in both bundles.

The eight browser files affected by this checkpoint pass independently.
Initial and final `check:all` pass all eight gates; UI contracts remain at
0 errors, 77 warnings and 11 information, with no new fanout error. The first
final check caught a test-only geometry-map typing error; it was fixed before
the passing rerun. Logs are `embedded-table-start.log`,
`table-reference-final.log` and `table-reference-browser/`.
No runtime implementation changed. The full migration, concurrency correction,
mobile overflow correction and remaining goal scope are still outstanding.


### Embedded tables use document binding

Details containing table fields now enter the declarative path. Column
composition reads dashboard definitions only. `static/.../detail/table.html`
defines headers, cells, editors, options and row actions; ordinary repeats
apply row values and lookup options. The table and row visual shells encapsulate
the existing styles. Native text cells and official editor controls are slotted
directly into rows. No private core, JSON attribute, template-use mechanism or
repeat key was added.

Table context projects stable positional row records and formatted values.
Reading an operation merges edited columns into their original row records,
preserving unknown identifiers and nested metadata. Add/remove interactions
change draft arrays; binding updates the rows. Cartesian derivation is a pure
projection shared with the remaining legacy path, and bound derived tables
receive draft values instead of imperative DOM replacements.

Nested lookup columns use one hidden binding source per column, shared by all
rows. The existing lookup controller exposes its option/query state to the
detail's binding context. The table forwards only user search/load-more events
to the matching source; no response data is forwarded to a renderer. Dependency
URLs, debounce, pagination, stale-response handling and the double-click guard
remain owned by that source/controller. The column source is not wrapped around
the rows because an independent source has its own scope; no binding-core
extension was necessary.

Editable table drafts retain empty added rows, while action payloads omit empty
rows. Submission snapshots distinguish an empty row already submitted from one
added during an in-flight save. This also applies when a condition hides the
table. Acknowledging a response clears only the corresponding submitted draft;
it retains later edits and later added rows. The formerly failing concurrency
probe now passes as a checked-in regression test, including focus, selection
and geometry across five frames.

Eight table browser cases now cover:

- Selected detail: all four column editor types, nested/opaque row values,
  removal, blank-row omission, two saves/reloads and Cartesian combinations.
- Standalone detail: save an empty table and matrix, create a new row, save and
  reload its value.
- Pending options and overlapping saves: unchanged text focus/selection/geometry,
  preserved newer edits, a second save and persisted reload.
- Add a blank row while a save is pending, keep it after the response, fill it
  and verify the next saved reload.
- Two lookup columns shared across rows: isolated searches, stale response,
  pagination/double clicks, failure/new query, dependent category and saved values.
- Mobile failed save and retry from a long detail: bottom draft, selection,
  scroll and navigation positions remain stable across five frames.
- Conditional hide/reveal and save while hidden: retain added/edited rows and
  derived data, omit an extra empty row, then verify the reloaded values.
- Seven desktop/mobile visual states, including horizontal scrolling to the
  rightmost Remove button in both old and new bundles.

All writes above are route-fixture persistence. These cases do not establish
real local database writes or provider behavior. The mobile access check also
corrects the reference checkpoint's initial interpretation: the original table
already scrolls horizontally. Both versions expose the rightmost controls;
the new shell retains that behavior without page-level overflow.

The final seven capture pairs preserve all measured field, row and navigation
geometry, including the table's effective scrollable width. Three pairs are
pixel identical; the other four differ by 4, 7, 7 and 15 border pixels. Images
were inspected. Evidence is `table-migrated-captures/`,
`table-migration-visual-{0..4}.log` and `table-migration-timings.json` under the
existing evidence directory. Five-run medians in milliseconds are:

| State | Desktop original / current | Mobile original / current |
|---|---:|---:|
| Ready | 203.2 / 201.9 | 172.3 / 193.4 |
| Empty | 157.9 / 181.8 | 156.2 / 181.7 |
| Pending lookup | 169.8 / 189.9 | 168.2 / 193.4 |

Each initial case makes one detail GET and one shared lookup GET. Save-response
medians are 52.7ms originally and 52.5ms now. Original saves issue one additional
lookup GET; current saves issue none. Neither refetches the main detail. The
separate five-run probe checks both rendered and fixture-persisted values;
evidence is `table-save-benchmark.ts`, its log and `table-save-timings.json`.

Initial rendering is still slower in several states. Chromium profiling compares
the original bundle, the immediately preceding table-reference bundle and the
current bundle. Before removing redundant visual cell wrappers, current median
script work was 75.0ms; afterward it is 66.7ms, compared with 49.5ms for the
preceding bundle in the latter run. The reported Nodes metric decreased from
21,052 to 18,128. These are separate profiling runs and do not prove a wall-time
speedup. Remaining initial binding cost belongs in the final performance review;
this checkpoint claims stable interactions and fewer save requests, not an
overall speed improvement. Raw profiles are `table-initial-profile-wrapped.json`
and `table-initial-profile.json`.

All 54 dashboard browser tests across 46 files pass in separate Bun processes,
and 181 Control tests pass. The final table structure was rechecked with all
its affected browser files. Build and initial/final check:all pass all eight
gates; UI contracts remain 0 errors, 77 warnings and 11 information. The table
fixture's 152-line information and the eight-entry browser directory were
reviewed and retained as cohesive responsibilities. Existing event/state files
are 235/270 lines: their shared event and draft responsibilities remain together
while the remaining legacy branch is pending removal. No fanout error or rule
exemption was added.

Grouped browser runs again stalled during a reload: after successful retry,
`/control.js` did not finish and data endpoints were never reached. Logs
`table-migration-final-flows.log`, `table-migration-final-flows-retry.log` and
`table-migration-batch-debug3.log` retain those failures. The previously recorded
original-bundle grouped navigation failure remains relevant; the root cause of
this harness behavior is not established here. Diagnostic logging was removed,
no timeout was increased, and passing isolated runs are recorded separately in
`table-migration-browser/`. Held mobile fixture requests are released in cleanup.

The old table renderer is relocated under `controls/table/legacy.ts` for mixed
details still containing reorderable lists and for manual examples. It is not
a permanent compatibility contract and must disappear with those consumers.
Reorderable lists/cards and nested media, metadata relays, complete operator and
provider coverage, real local writes/cleanup, final performance review and
runtime activation still prevent goal completion.


## Reorderable choice references — migration not yet applied

The new `detail-binding/collections/reorderable/` browser fixtures establish the
remaining complex field's behavior before replacing its imperative renderer.
Existing table tests moved into the sibling `collections/tables/` directory;
their fixtures and bundle paths were adjusted, with no behavioral changes.

Four browser tests cover these reference paths:

- Rows and cards: nested text edits, boolean checkbox, select, shared lookup
  combobox, real pointer drag, add/remove limits, custom nested position path,
  opaque metadata, two saves and reloaded values.
- Page/secret selectors inside card settings: published-page restriction,
  choosing both references, dragging the owning choice, saving, clearing the
  credential and reloading. Only fixture key names are returned; no actual
  credential is created or transmitted.
- Nested media: upload, replacement and removal return an asset to the parent
  draft; the subsequent detail save persists the choices. Multipart content,
  parent identity, previous asset ID, unrelated metadata, notes typed during
  upload and reloaded asset values are checked.
- Desktop/mobile captures: rows/cards ready, empty and pending lookup states,
  expanded card settings and both mobile layouts scrolled to the bottom.
  Bottom checks include visible notes, stable mobile toolbar and document width.

All persistence here is in controlled route fixtures, not the local database.
These references do not establish complete error/concurrency coverage or prove
that reorderable lists have migrated to binding. In particular, required nested
field validation and remote pagination still need dedicated coverage.

The original goal bundle and the current pre-migration bundle have equal measured
geometry in all 16 visual pairs. Fifteen pairs are pixel identical; mobile empty
rows differ by ten border pixels. Representative desktop/mobile, expanded,
bottom and nested-media images were inspected. Three additional nested-media
captures record ready, uploaded draft and saved states. Evidence lives under
`/tmp/cmscore-widget-binding-20260907/` in `reorderable-reference-captures/`,
`reorderable-reference-pixels.json` and `reorderable-reference-visual.log`.
Initial timing samples and request counts are retained in
`reorderable-reference-timings.json`; these single samples are a replay reference,
not a performance claim. Every initial state issues one detail GET and one shared
lookup GET.

The separate `reorderable-lifecycle-probe.ts` records actual pre-migration failures
in `reorderable-lifecycle-before.json` and its log. Across rows/cards and both
viewport sizes, delayed options preserve the entered text but destroy focus and
selection. Expanded cards close; the mobile card scenario's scroll changes from
401 to 292 pixels. A delayed save overwrites a newer edit with its submitted
value, loses focus/selection, and a second save plus full reload confirms that
the newer value was lost. Each of the two saves also refetches the lookup: the
whole sequence has four lookup GETs and two detail GETs including reload.
These are pending migration requirements, not accepted UI changes or passing
stability tests.

The affected table/reorderable tests pass independently: 12 tests in ten files.
The visual comparison was rerun after adding bottom-scroll assertions. No runtime
source or generated bundle changed in this reference checkpoint. Initial and
final check:all pass all eight gates; UI contracts remain at 0 errors, 77 warnings
and 11 information, with no directory-fanout error. The 155-line
nested fixture is retained as a cohesive definition and route contract, with no
rule exemption. The next step is the actual binding migration and conversion of
the observed concurrency failures into strict regression tests. The larger goal,
including real local persistence, operator coverage and runtime activation,
remains incomplete.


## Reorderable fields use document binding

Configured details now compose every field family through binding, including
reorderable rows/cards. The temporary supported-type gate and the configured
fallback that forwarded detail/status objects through `cms-dashboard-input`
have been removed from mounting, reconciliation and `WDetail`. An omitted field
type retains the existing text-field default. The source-controls browser test
exercises that default through the shared admin composition.

`widgets/w-reorderable-list/binding/` supplies definition-only composition,
encapsulated visual shells, pure positional projections and local interaction
handlers. Rows, controls, options and nested media declarations stay in document
light DOM. Definitions select controls from static templates; response values
never construct their HTML. Native checkbox values and disabled button states
use the binding's typed/boolean bindings. No private core, repeat key, runtime
template-reference feature or response-object transport was introduced.

Adding/removing/dragging creates a local operation snapshot that preserves opaque
fields and the configured position path. Unchanged optional controls retain their
original missing values. Required nested controls now block an invalid save and
clear their visible error when corrected. Shared lookup sources serve each
nested combobox field across all rows, preserving query isolation, pagination
and dependency changes without a request per row or per save.

Nested media reuses the existing bound media component and its static templates.
The owner retains local blob URLs used by nested fields as well as top-level
media. Media completion reads the current detail draft, including text that has
not blurred. Operations carry the existing domain key path to locate a choice
that moved during a request; settling a stale asset edit checks its submitted
asset identity before applying a result. The configured path writes the resulting
local draft back through binding. The remaining manual-example fallback is
isolated in `view/actions/nestedMedia.ts` and still requires removal with its
consumers.

The initial nested-media regression test reproduced lost unblurred typing. Its
failure is retained in `reorderable-migration-media-lifecycle-before.log` in the
existing evidence directory. The corrected test also moves the affected choice
during a failed removal, restores its original image on the correct row, keeps a
new edit on the other row and checks both values after save/reload.

The nine reorderable browser tests cover:

- Rows/cards, real pointer dragging, add/remove limits, required-field errors,
  all scalar editors, opaque fields and two saved reloads. Assertions require
  rows and control hosts to be in document light DOM.
- Delayed options and saves on desktop/mobile for both layouts: draft, focus,
  selection, expanded card, field geometry and scroll are unchanged over five
  frames; the newer value survives the next save and reload.
- Mobile bottom-of-form 503 failure and retry with current notes, selection,
  toolbar and scroll preserved.
- Published page/secret references, saved movement and clearing the credential.
- Two shared remote lookups: isolated queries, stale responses, offset pagination,
  duplicate load-more interactions, an error/retry and a dependent category.
- Nested upload/replace/remove with multipart content and parent save; concurrent
  typing and failed removal after drag; desktop/mobile preview, close, focus
  restoration and absence of preview writes or file pickers.
- Sixteen desktop/mobile state comparisons, including expanded settings and
  scrolled bottoms, plus three nested-media captures with measured geometry.

All of this persistence is in route fixtures. Real local persistence and cleanup,
operator permissions/endpoints and provider coverage are still separate pending
requirements. Further nested-media write combinations and new-choice lifecycles
remain part of the final coverage audit.

The full dashboard browser suite passes independently: 63 tests in 55 files.
All 181 scoped Control tests in 60 files pass. The full build and initial/final
check:all pass; UI contracts remain 0 errors, 77 warnings and 11 information.
Evidence is `reorderable-migration-browser/`, `reorderable-migration-control.log`,
`reorderable-migration-build.log`, `reorderable-migration-start.log` and
`reorderable-migration-final.log` under the existing evidence directory.

The eight-entry source/template/test directories and the 162-line interaction
controller were reviewed as cohesive responsibilities. No fanout error or rule
exemption was added. Existing mixed legacy/bound files remain 255 lines for
`WDetail/index.ts` and 274 for `runtime/fieldState.ts`; the pending removal of the
manual path should remove responsibilities rather than merely repartition them.

Visual inspection found the global `code` background leaking into the new light
DOM identity label despite equal layout measurements. A plain identity span with
encapsulated typography preserves the original appearance. Final captures retain
equal geometry; pixel comparisons are recorded in
`reorderable-migration-pixels.json`, `reorderable-migrated-captures/` and
`reorderable-nested-{before,after}/`. The remaining differences are border pixels.

The goal remains active. Manual example renderers, JSON attribute readers,
definition/navigation object relays, the complete real-service/operator audit,
final performance review and activation of the validated local runtime still
prevent completion.

Final reorderable measurements use five sequential before/after trials on the
final built bundle. The values below are median milliseconds to the fixture
state; expanded rows measure initial readiness before expansion.

| Layout | State | Width | Before | After |
| --- | --- | ---: | ---: | ---: |
| cards | empty | 390 | 157.5 | 179.5 |
| cards | empty | 1440 | 161.9 | 182.0 |
| cards | expanded | 390 | 176.5 | 190.4 |
| cards | expanded | 1440 | 180.3 | 199.6 |
| cards | pending | 390 | 163.7 | 189.1 |
| cards | pending | 1440 | 173.8 | 187.3 |
| cards | ready | 390 | 176.2 | 191.7 |
| cards | ready | 1440 | 178.7 | 194.2 |
| rows | empty | 390 | 161.2 | 178.7 |
| rows | empty | 1440 | 170.5 | 181.0 |
| rows | pending | 390 | 166.6 | 188.4 |
| rows | pending | 1440 | 172.5 | 186.1 |
| rows | ready | 390 | 169.3 | 190.2 |
| rows | ready | 1440 | 198.6 | 200.1 |

The save interaction median is 53.9 ms before and 49.5 ms after.
Each old save triggered one additional lookup; the bound version triggers zero.
Neither version adds a main-detail read for this interaction. Initial readiness
is still slower in several states, so this is not an overall performance gain;
the final performance audit remains open. Logs and JSON measurements are retained
as `reorderable-migration-visual-{0..4}.log`,
`reorderable-migration-timings.json` and `reorderable-save-timings.json`.

## Sandbox detail uses the same bound composition

The example detail now has a normal `DashboardWidget` definition, composed once
with `composeDetail`, and a URL-less source seeded through `setSourceData`.
Product values no longer enter a `WDetailData` response-to-DOM renderer. The
example's two empty-state hints are applied to the composed controls before
binding. Its field-change handler updates the in-memory sandbox values without
replacing the dashboard. This preserves its existing demonstration semantics:
Save emits an action, and values survive leaving/reopening the detail within the
same document; it is not a server persistence test.

The browser example flow now checks document light-DOM controls, title and
textarea editing, five-frame focus/selection/geometry retention, both selects,
combobox selection, custom tokens, submitted action fields and restored values
after list/detail navigation. The original table checks still cover bulk
selection, a URL-less seed, changing to a real fixture endpoint and source
teardown. `table-binding/example.test.ts` moved into `table-binding/example/`
beside its new visual test, keeping the parent at seven entries.

Request inspection revealed native `src="{{ ... }}"` images requesting unresolved
expressions before compilation. Bound media tiles, preview images and thumbnails
now use the existing `data-cms-src` image runtime, as readonly image fields already
do. No image adapter or binding feature was added. The example comparison asserts
that no unresolved image URL is requested: both versions request the document,
stylesheet, bundle and one actual image, with no API/source requests.

Image inspection also caught an accidentally enabled multiple-media option in
the example definition. Restoring the original single-media setting removes the
extra Add tile, and the visual test explicitly checks its absence. Final ready
and open-menu captures at 1440 and 390 pixels are pixel-identical to their
before images, with equal field geometry. The four pairs are in
`example-detail-migrated/`, compared by `example-detail-pixels.json`.

Five sequential before/after trials on the final bundle measure median detail
navigation readiness of 105.7/106.7 ms at 1440 pixels and 85.9/105.9 ms at 390
pixels. The mobile overhead remains a performance-audit item. Measurements are
`example-detail-timings.json` and `example-detail-visual-{0..4}.log` in the
existing evidence directory. The pre-migration bundle is preserved separately as
`example-detail-before-bundle.js`.

The comparison also confirms a pre-existing mobile overflow: the standalone
example is 437 pixels wide in a 390-pixel viewport. The action row contributes to
this problem. Pixel equality is not an overflow pass; correction and the wider
navigation/scroll audit remain required before completion.

Validation for this step:

- The 15 affected example/media browser tests in 13 independent files passed,
  including top-level and nested media failure, preview and draft lifecycles.
  Results are in `example-detail-browser/`. After the example-only hint and
  single-media corrections, both example tests were rerun successfully; final
  flow and visual logs are `example-detail-flow.log` and
  `example-detail-visual.log`. Five final comparison runs also pass.
- The final full build passes (`example-detail-build.log`). Initial/final
  `check:all` both pass all eight checks (`example-detail-{start,final}.log`).
  UI contracts remain 0 errors, 77 warnings and 11 information. No fanout error
  or exemption was introduced. The 166-line end-to-end example flow is retained
  as one cohesive navigation/edit/action/restoration scenario.
- The prior reorderable migration is committed as `7c6b734ee`.

Configured details and the example now use bound composition. `WDetail` still
contains unused/manual compatibility entry points and the old view, lookup and
schema controllers, with tests that still exercise those paths. These must be
removed or migrated next; keeping them for their tests would not satisfy the
goal. Definition/navigation object relays, the complete service/operator/provider
matrix, real local persistence and cleanup, performance/overflow fixes and final
runtime activation also remain open. The goal is not complete.

## Manual detail entry points removed

`WDetail` now contains its visual shell and local editing/validation operations.
It has no `.data` property, JSON attribute reader, manual/bound mode switch,
response renderer, private lookup/schema loader or rendering scheduler.
`DetailEvents` and `DetailFieldState` read the document-bound controls. The old
view, action renderer, schema/lookup controllers and their unused styles are
removed. Nested media settlement operates on the actual bound detail draft.

The integration connection settings consumer now composes a normal detail
widget definition and supplies values to its URL-less binding source. The new
connection browser fixture covers required validation, failed saves, retry,
canonical server values, opaque metadata preservation, revision checks,
restoration after document reload and read-only Health navigation. Its server
state is simulated in the browser routes; this is not real local persistence.
The surrounding `IntegrationManagementView` still reads and rebuilds panels
imperatively, including after saves, and injects a light-DOM style from its shell.
Its full binding/lifecycle migration remains necessary. The connection test
proves idle presentation and the listed behaviors, not absence of save-time
layout shifts in that legacy surrounding controller.

Migrating the existing tests exposed three problems that were fixed rather than
removing their assertions:

- Happy DOM 20.9.0 stored its mutation delivery callback only through `WeakRef`.
  After garbage collection, existing observers silently stopped delivering
  mutations. A minimal forced-GC test reproduces it. The versioned Bun patch
  retains that callback for the observer lifetime; disconnect is still tested.
  This affects only test dependencies. Installing the patch also synchronized a
  stale lockfile-only runtime development dependency with its existing manifest.
- Binding teardown left rendered text in the DOM, so remounting captured old
  values instead of expressions. Core shutdown and detached-source disposal now
  restore authored declarations. Chromium verifies remounting a dashboard,
  dropping the detached local draft, retaining saved server data and saving
  again without duplicate submissions.
- Replacing the private detail request coordinator initially made two equivalent
  lookups and a schema issue three reads. Concurrent automatic reads are now
  shared inside the page core, restoring the original single request. Consumers
  cancel independently, results are isolated snapshots, completed/error reads
  are not cached, and separate cores and submissions do not share work. The
  tests also exposed a response arriving between a URL mutation and observer
  delivery; it is discarded before publication and the current URL is fetched.

The reorderable detail used to emit a change during text input. Its bound
interaction controller now preserves that behavior, including the edited
control, focus and an independent earlier value snapshot. This avoids changing
field-driven behavior while removing the old renderer.

Validation and evidence for this checkpoint (all under
`/tmp/cmscore-widget-binding-20260907/`):

- `legacy-detail-unit-final.log`: 545 passing tests across 136 files, covering
  all Control admin tests, the foundation binding suite and the forced-GC
  regression. Existing detail tests were migrated to real declared composition,
  page-owned cores and light-DOM controls rather than retaining the deleted API.
- `legacy-detail-browser-final/` exercises all 64 dashboard browser tests in 56
  independent files. Its table comparison initially assumed every baseline was
  the former manual table; selecting the actual scroll container fixes that
  test harness assumption. `legacy-detail-browser-current/` reruns all affected
  reorderable tests, the corrected desktop/mobile table comparison and core
  reconnect behavior on the final interaction implementation. The combined
  `legacy-detail-browser-results.json` has no failure.
- `legacy-detail-connection-first.log` adds one passing browser test at both
  1440 and 390 pixels against the immutable pre-cleanup bundle, exercising the
  connection behaviors above. Together these are 65 browser tests in 57 files.
- `legacy-detail-pixel-comparison.json`: 78 comparable before/after image pairs,
  74 pixel-identical. Four pairs differ by 12–26 pixels in text/control edges;
  every geometry comparison passes. Images inspected include the connection
  screen at both widths, mobile media, CMS users, empty schema and the scrolled
  mobile table. Connection images are exactly identical at both widths.
- The single connection readiness comparison measures 175.4/165.5 ms at 1440
  pixels and 147.4/167.8 ms at 390 pixels, with six initial requests in both
  versions. These individual observations are not a performance improvement
  claim. Other fixture timings remain in their browser logs. The baseline is
  `legacy-detail-before-bundle.js`, preserved from `2270520f7`.
- `legacy-detail-build-verified.log`: full workspace build passes. Initial and final
  quality reports are `legacy-detail-start.log` and
  `legacy-detail-quality-verified.log`: all eight checks pass. UI contracts remain
  at 0 errors, 77 warnings and 11 information. No fanout error or exemption was
  introduced. The lifecycle scenarios and local editing classes remain cohesive
  despite advisory file-size findings; most migrated files became shorter.
  The connection browser fixture and forced-GC test pass again in
  `legacy-detail-connection-verified.log`. Frozen installation of the runtime-only
  Happy DOM patch succeeds (`legacy-detail-frozen-install-final.log`).

The dependency patch is committed as `338b0c50d`; the binding lifecycle and shared
reads are committed as `acb788f34`.

This checkpoint does not complete the goal. Old standalone control creators and
legacy media/reorderable components remain referenced by tests and reader
modules; their remaining compatibility branches must be removed next. The
integration management controller, definition/navigation relays, complete
operator/provider matrix, actual local persistence with cleanup, outstanding
performance/overflow review and final local-runtime activation are also open.

### Legacy control factories and standalone widgets removed

The remaining manual field factories are deleted: basic/display inputs,
reference editors, schema fields, table rows and the obsolete standalone media
and reorderable components. Detail table mutations now update their draft and
let binding render the rows; they no longer choose between a bound control and
an imperative fallback. Readers, validation, media operations and drag feedback
remain because they implement editing behavior rather than response rendering.
The official page-link element is registered at the Control bundle entry point.

The last factory-based tests now compose a real detail with a page-owned core.
They retain assertions for typed values, readonly snapshots, opaque table
metadata, nested media action scope, safe property paths, drag ordering and
focused inputs. Media preview tests also install the real bound-image runtime,
including URL changes and native load/error events. Happy DOM's sibling-shadow
`activeElement` limitation requires blurring the second thumbnail before the
unit End/Escape sequence; the Chromium preview test retains thumbnail focus and
exercises the complete keyboard sequence and focus restoration.

Page-link loading is deferred to the next microtask and checks connection first.
This skips the briefly connected authored control that binding captures before
mounting its compiled copy. The bound reference regression checks exactly one
published-pages GET. The editor shell fixture now registers its test subclass
in the current document instead of constructing a cached class owned by a
previous test document and manually calling its connection callback.

Verification for this checkpoint (all evidence below is under
`/tmp/cmscore-widget-binding-20260907/`):

- `legacy-controls-unit-final.log`: 363 passing tests in 107 files, covering all
  Control admin and editor-system-v2 tests. The editor shell entry also runs its
  isolated 101-case suite. The migrated preview/reorderable tests contribute
  seven tests with 55 assertions.
- `legacy-controls-browser/results.json`: 37 passing Chromium tests in 31 files,
  covering scalar fields, schemas, readonly fields, tables, reorderable fields,
  nested media and references, media operations/recovery and connection settings.
  These are controlled HTTP fixtures, not proof of actual local persistence.
- `legacy-controls-browser/pixel-comparison.json`: 44 before/after pairs, 41
  pixel-identical. Mobile media differs by 26 pixels and empty schema screenshots
  by 11–14 pixels. All geometry assertions pass. Inspected images include mobile
  media before/after and expanded desktop reorderable cards. The immutable
  reference is `legacy-controls-before-bundle.js` from `f56bddb42`.
- The connection fixture records six initial requests in both versions and both
  widths. Individual ready timings are 204.1/175.5 ms at 1440 pixels and
  181.6/197.5 ms at 390 pixels. These single observations are not a claim of a
  performance improvement; repeated performance analysis remains open.
- `legacy-controls-build.log`: complete workspace build passes.
  `legacy-controls-start.log` and `legacy-controls-quality-final.log` both pass
  all eight checks. UI contracts remain at 0 errors, 77 warnings, 11 information;
  no exemption or directory fanout error was introduced. The typed-control test
  remains a cohesive scenario suite despite its advisory size finding.

This cleanup does not finish the goal. The integration management outer
controller still replaces its panel after save and renders health reports
imperatively; its shell injects CSS into light DOM. Definition/navigation
`cms-dashboard-input` relays also remain. These must be migrated, followed by
completion of the operator/provider coverage matrix, real local persistence and
cleanup, repeated timing/request review, the known example mobile overflow and
final activation of the validated local runtime. No production or external
provider operation was performed for this checkpoint.

### Connection settings retain their bound editor during operations

`mountSettings` now composes from `DashboardField` definitions and gives the
existing detail a real settings read source with `itemPath: "values"`. It no
longer receives a settings response to seed a newly rebuilt editor. The old
`readSettings` wrapper and management controller's duplicate settings state are
removed. Loading, read errors, empty responses, retry and pending application
are declared in `sources/_management/settings.html`. A generic detail `footer`
slot keeps the application button after the detail shell without a second
response renderer.

Saving captures submitted fields against the current source snapshot, preserves
opaque/nested values and includes the expected revision. This typed POST remains
an operation helper: the current source-body contract supports raw scalar,
query-parameter and string-state bindings, not this arbitrary nested object
snapshot and revision contract. Its result is applied with `setSourceData` after
acknowledging only the submitted snapshot. There is no subsequent GET or panel
replacement. Newer edits remain in the draft; input controls remain editable
while action buttons prevent duplicate operations. Disconnected save responses
cannot update a replacement management host or its feedback. Applying saved
configuration refreshes the existing settings source and preserves unsaved fields.

Checkpoint verification (under `/tmp/cmscore-widget-binding-20260907/`):

- `management-settings-unit-final.log`: all 284 Control admin tests pass in 89
  files. Existing settings path/payload and lifecycle tests use the new mount.
- `management-settings-browser-isolated/results.json`: six passing Chromium
  tests in four separate Bun processes. Connection flows cover validation,
  failure/retry, canonical saves, reload, Health navigation, initial-read retry,
  an empty response with retry, applying configuration without saving a draft,
  and completion after a simulated client navigation replaces the host.
- The long-form test runs at 1440 and 390 pixels: a double click produces one
  POST, a newer country/notes draft survives its delayed response, and five
  successive frames retain input focus, selection endpoints, ancestor scroll
  positions and screen position. The second save uses the new revision; a full
  reload returns the later saved values and preserved opaque metadata. It
  asserts exactly one settings GET before these saves.
- The same directory contains pending/saved long-form captures and four
  before/after connection/readonly pairs. `pixels.json` reports all four pairs
  pixel-identical; geometry assertions pass. Inspected images include the
  desktop/mobile connection screen, mobile long-form selection during/after
  saving, and the readonly desktop detail. The immutable starting bundle is
  `management-before-bundle.js` from `34513b9b5`; an initial pre-edit run is in
  `management-before-connection.log`.
- Initial connection requests remain six in both versions. Ready timings in the
  comparative logs are single observations, not performance improvement claims.
  The saved source's eliminated extra GET is verified separately by assertion.
- `management-settings-build-verified.log` passes the full build; the final
  empty-state declaration correction is included by the successful Control
  rebuild in `management-settings-empty-build.log`. Initial
  `management-binding-start.log` and final `management-settings-quality-verified.log`
  pass all eight checks, with unchanged UI contracts: 0 errors, 77 warnings and
  11 information. No exemption or fanout error was introduced.

Grouped browser execution again hits the previously documented harness problem.
`management-settings-browser-page-creation.log` narrows this occurrence to
`browser.newPage()` for the final mobile page, after all preceding page actions
and closure complete. The test passes by itself; the complete same test set
passes with the established per-file process isolation above. The grouped
failures remain recorded, the underlying harness issue is not claimed fixed,
and no timeout was increased. Temporary stage logging was removed.

The empty-state E2E also caught unsupported grouping parentheses in an authored
condition. The declaration now uses the existing AND/OR precedence directly;
no binding-language extension was introduced.

This is still an intermediate goal checkpoint. The management installation
loader, Health renderer, embedded dashboard/collection branches, shell CSS in
light DOM and definition/navigation relays remain to migrate. Full operator and
provider coverage, actual local persistence/cleanup, repeated performance and
overflow review, and final local-runtime activation remain open. All endpoint
writes in this checkpoint were controlled browser fixtures; no production or
external provider was changed.

The existing management controller now has 186 lines (previously 172), producing
an advisory file-size warning. Its operation guards and panel lifecycle remain
together until the pending shell/Health migration removes those branches;
splitting this temporary controller only to cross the threshold would obscure
that work. This warning is retained deliberately.
