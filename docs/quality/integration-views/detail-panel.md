# Reusable detail panel

Full detail views opened with `presentation: "modal"` use a full-height side
panel. Page detail views and short operation dialogs keep their presentation.
The integration definition, fields, binding context, form and endpoints remain
shared between page and panel views.

## Presentation and form ownership

- `p9r-modal[placement="end"]`: 1080 px maximum width, constrained to 96% of the
  desktop viewport, and full viewport height. Below 640 px it fills the viewport.
- `content-layout="contained"` delegates scrolling to the slotted content.
- `cms-shell-detail[contained]`: fixed header/footer and a scrolling body. Footer
  submit actions remain associated with the existing light-DOM form.
- `cms-detail-section` retains the same cards, spacing and typography as page
  views. The contained shell uses the admin's `--bg-base` background, including
  its header and footer; main and aside have no extra surface wrappers.
- `cms-shell-detail-body[tabbed]` keeps main and aside as distinct columns above
  760 px of available body width. Below that width,
  the official `p9r-tabs` component shows Details and Settings tabs.
- No tab bar appears when the aside is empty. Shell attributes `main-label` and
  `aside-label` can customize its labels; the integration schema has not acquired
  separate label configuration in this change.
- Inactive panels remain mounted. Hidden controls retain their form association
  and are included in submission. Resizing and switching tabs do not recreate
  fields or fetch a new detail response.
- Native invalid events reveal the first affected region during validation.
  Custom detail validation calls the body's `reveal(control)` before focusing
  the invalid control. Error messages remain owned by existing controls.
- `p9r-tabs[expanded]` shows all panels as labelled regions without the tab bar;
  removing the attribute restores the selected tab. Arrow navigation now uses
  the focused button within the component's shadow root.

The binding runtime and integration endpoints were not changed. Main and aside
stay in one form; independent operations retain their separate forms.

## Verification

All work is local and uncommitted. Production was not modified.

- `bun run check:all`: 8/8 before and after. UI contracts remain at 0 errors,
  63 warnings and 11 informational findings.
- `bun run build`: passed.
- 20 browser tests passed across shared-shell, creation/navigation, panel,
  creation recovery and independent-operation suites. Coverage includes desktop
  columns, mobile tabs, keyboard navigation, retained field nodes and values,
  submission from Settings including hidden main fields, invalid fields in either
  region, no-aside views, long-form scrolling, fixed actions, background position,
  focus restoration, guarded close/Cancel/Escape/backdrop, and failed-save retry.
- Real localhost UI at 390 px: created a temporary brand while Settings was
  selected, verified main fields and status in the saved resource, edited it,
  independently reloaded it, then deleted it through its confirmation dialog.
  All three mutations returned HTTP 200. The parent product was not saved.
  Evidence: `/tmp/cmscore-panel-tabs-local-save-proof.json` (brand 23, cleaned).
- Final screenshots, visually inspected:
  `/tmp/cmscore-detail-panel-desktop.png`,
  `/tmp/cmscore-detail-panel-mobile-details.png`, and
  `/tmp/cmscore-detail-panel-mobile-settings.png`.
- After restoring the page's section cards and background, the shared-shell,
  panel and creation/navigation suites were rerun: 13 tests passed. Desktop and
  both mobile tabs were captured again; mobile had no horizontal overflow.

The shared shell stylesheet remains 163 lines, with an informational file-size
finding. Page and contained-layout rules remain together for reviewability.
