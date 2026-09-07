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
