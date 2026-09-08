# Monetary fields in detail and action forms

`p9r-money-input` uses the existing input template and styles. Its `value`
property and native form contribution are strings containing integer minor units;
the visible input accepts localized major units. `currency` determines precision,
and `allow-decimals="false"` restricts entry to whole major units. Typed JSON
forms use `cms-form-value-type="number"`, with the existing empty-value policy.

The component owns conversion, validity, unfinished text and caret preservation.
It supports required, disabled, readonly, native reset and form-state restoration.
The monetary conversion functions moved from Control to the foundation package;
detail widgets no longer retain a separate formatted monetary draft.

Action fields use their `path` to read initial values from the shared detail
resource, and `name` to choose their submission key. The existing source context
projects each action's resource and currency rules; fields remain in light DOM
and use ordinary value interpolations. No additional GET, nested binding core,
raw JSON attribute or new binding API is involved. Opening the operation resets
its controls through the native form reset; submission errors retain edits.

Verification includes native FormData and typed JSON submission, EUR/JPY/KWD,
whole-unit restrictions, empty/required fields, disabled fieldsets, reset,
unfinished input, failed action retry and parent-node preservation. Existing
detail screenshots and dimensions match the baseline at 1440 and 390 pixels.
The action browser fixture uses simulated HTTP responses; the Commerce offer
definition and endpoint have not yet been migrated by this change.

The 171-line control remains cohesive: it owns one input's lifecycle and form
contract, with conversion algorithms in a separate file. Its size finding is
informational. No integration version or production installation was changed.
