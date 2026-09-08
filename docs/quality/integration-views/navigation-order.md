# Navigation ordering through a form

Commerce remains at version 1.0.0. The `brandsTable` and `categoriesTable`
reorder actions now declare `form: { endpoint: "reorderBrands" }` and
`form: { endpoint: "reorderCategories" }`, respectively. Their endpoints and
request bodies are unchanged.

## Contract and ownership

`reorderable.action` references the action as before. With a form action, the
navigation list is a form-associated control. Its `value` is the ordered ID
array. The default control name is `ids`; `reorderable.name` can override it,
and the form's `valuesPath` can add an envelope. Native FormData contains
repeated `name[]` entries; typed JSON serialization receives the array directly.

The independently associated form is composed from static HTML outside any
parent detail form. The component connects to the actual form and read source
when mounted, including when a parent binding creates its DOM from a template.
No raw JSON attributes, imperative HTTP requests, or binding-core changes are
needed for this path.

The component retains the pending ID order. A source context projects that
order over the last read response; `cms-repeat` renders the rows. The shared
form binding submits the value and reloads the list's read source after success.
It does not submit, validate, or reload a containing detail form.

This automatic submission accepts only the order, with no additional fields,
confirmation, `after` mapping, or disabled refresh. Those combinations are
rejected during dashboard validation. Legacy endpoint actions remain supported
for integrations that have not yet migrated.

## Pending writes and failures

- Further drags are blocked while a write or its re-read is pending.
- A rejected write restores the previous order and displays an error toast.
- A successful write followed by a failed GET retains the saved order. The
  source's Retry button repeats only the GET and unlocks dragging on recovery.
- The list and parent form remain mounted. The existing repeat implementation
  may recreate changed rows when their entries move. This does not introduce
  keyed reconciliation or promise preservation of individual moved row nodes.

## Verification

- Form validation and Commerce catalogue definition tests pass.
- Browser checks cover persistence across reloads, delayed requests, rejected
  writes, failed reads and Retry, concurrent drags, an invalid/dirty parent form,
  navigation to detail and back, and empty lists.
- Before/after desktop (1440 px) and mobile (390 px) captures have identical
  measured list/action geometry. Pending writes and recovery retain list bounds.
- Actual local Courtside: tested both lists (18 brands, 6 categories), verified
  persistence after page reload, then restored their original order. Each initial
  drag/write/re-read took approximately 185 ms. No page errors or horizontal
  overflow were observed. Only the local taxonomy dashboard was updated, with a
  backup taken first.
- `bun run build` and `bun run check:all` pass (8/8, matching the initial check).
  UI contracts remain at 0 errors, 63 warnings and 11 information findings.
- The broader navigation suite encountered intermittent 30-second timeouts in
  the source-navigation visual test; its isolated before/after run passed all
  12 desktop/mobile states. The targeted ordering suite passes all four tests.
- `WNavigationList.ts` is 203 lines and retains a file-size advisory. Its drag
  events and native form contribution stay together; source projection and
  submission lifecycle are separate responsibilities in `order/`.

This completes the navigation-order prerequisite, not the entire Commerce view
migration. Other Commerce views/actions and the legacy integration consumers
still require migration before the old runtime can be removed.
