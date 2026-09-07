# Test dependency patches

`happy-dom@20.9.0.patch` retains the mutation listener callback while its
observer owns the listener. The published implementation stores the callback
only in a `WeakRef`; garbage collection can silently stop all subsequent
notifications even while the observer and target are alive. This breaks delayed
binding tests. The patch preserves the existing disconnect behavior and affects
the DOM test dependency, not the browser bundle.

`packages/surfaces/cms-control/tests/dom-lifecycle.test.ts` forces collection
between two mutations and verifies notification delivery and disconnection.
Remove the patch when the installed dependency passes that regression test
without it.
