# Dashboard UI contract follow-up

Dashboard navigation, definitions and widget reads use the existing document
binding core. Their source/repetition/condition trees are light-DOM children,
including the operator workspace runtime. Visual widgets retain encapsulated
CSS and slots. Shared source-state and metadata markup lives in Control's
`src/static/admin/_content/sources/_runtime/` fragments.

## Composition and data handoff

The dashboard contract describes recursively nested sections, tabs and widgets.
The mounting layer composes that structure into light DOM using official stack,
card and tab components. It does not create a core, fetch the displayed rows or
copy styles into the document. Table rows and navigation items use declarative
repetition; detail resources arrive through `cms-bind-value` and an opt-in typed
receiver. The receiver caches values and emits a local typed event to its owner.

Widget definitions are passed directly through `configure()`; response objects
are delivered through `setBindingValue()`. Normal mounting no longer writes or
observes `data-config-json`, `data-source-json` or `data-filters-json`. Legacy
attribute inputs remain accepted for existing manual widget consumers. They are
not the recommended composition contract.

Unchanged dashboard definitions reuse widgets and source navigation items.
Filters update the table source URL without discarding its controls. Detail
saves reuse the detail host, sections and unchanged field controls. A changed
field definition or server-normalized value can replace the affected control.
Lazy tab panels remain mounted after their first visit. An error has a local
retry action; initial loading does not pretend that an empty form is editable.

## Network findings that still require review

The scanner intentionally recognizes programmatic `requestBindingData()` calls.
No dashboard file has been added to the infrastructure exception list.

| Location | Current responsibility and decision |
|---|---|
| `Dashboards/api.ts` | Metadata reads explicitly awaited by definition-changing actions and user-option resolution share binding transport. Initial navigation and dashboard reads are declarative. The remaining call is still a warning. |
| `Dashboards/runtime/source.ts`: JSON reads | Dependent lookup/schema requests use the existing request coordinator for cancellation, deduplication and stale-result rejection. They share binding transport; dependency-graph orchestration remains imperative and reviewable. |
| `Dashboards/runtime/source.ts`: JSON and multipart writes | Runtime-declared actions resolve endpoints and typed field mappings, coordinate returned resources and uploads, and use the shared submission transport. These are not declarative native forms; the scanner continues to warn. |
| `Dashboards/runtime/source.ts`: binary downloads | The only direct fetch in this module needs a Blob and Content-Disposition. The JSON binding result does not expose those. Keep this narrow binary operation separate; it remains a warning. |

Sharing transport centralizes response/error/abort handling. It does not itself
remove operation controllers or prove that their current declarative coverage
is complete. Future migration should preserve operation-specific ordering and
cancellation instead of translating calls into hidden forms solely to silence
the checker.

## Verification

Focused engine tests cover typed values, late component definition and unmount
ownership. Dashboard tests cover mapping, dependent lookups, schemas, action
results, selection and authorization. Browser scenarios cover document-owned
binding, source failures/retry, filtering, saving, operator scope, source controls
and narrow tables. Live local screenshots compare real Commerce and Consent
screens on desktop and mobile; no production operation is required.

Static quality does not prove visual stability. Browser checks must also retain
element handles and compare scroll/focus around refreshes; screenshots alone
cannot establish that a component was not reconstructed.

The task's before/after `check:all` result is 7/8 → 8/8 passing checks. UI
contracts moved from 3 errors, 77 warnings and 11 informational findings to
0 errors, 77 warnings and 11 informational findings. Remaining warnings are
review items, not silently accepted exceptions.

File-size review: the detail lifecycle, section reconciliation, navigation-list
controller and complete browser lifecycle scenario exceed the 180-line review
threshold. They stay together because each owns one lifecycle and its associated
state; a size-only split would scatter that ownership. Existing larger table and
source-state test files remain in place. No directory-fanout error was introduced.
