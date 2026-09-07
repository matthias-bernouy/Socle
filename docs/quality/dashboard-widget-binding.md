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
| Collections | Embedded tables, reorderable rows/cards, derived values | Pending |
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
