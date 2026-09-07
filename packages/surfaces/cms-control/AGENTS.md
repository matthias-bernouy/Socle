# @bernouy/cms-control

Admin surface. It mounts on a provided `Runner` and exposes authenticated admin
HTML, the admin REST API, editor endpoints, sources/admin media routes, and the
browser bundle in `src/static/assets/control-components.js`.

## Export Boundaries

- `@bernouy/cms-control`: server-side `ControlCms`.
- `@bernouy/cms-control/component`: view-side component authoring, only
  `Component` from `@bernouy/components/base`. Compositions are server-rendered
  resources without a view class.
- `@bernouy/cms-control/editor`: editor-side bloc authoring helpers. Bloc editor
  bundles are rewritten by `p9rExternalsPlugin` to use `window.p9rEditor`.

Do not let the view authoring subpath import editor code, Control internals, or
server-only modules.

## Package Layout

- `src/ControlCms.ts`: mounts routes and wires injected dependencies.
- `src/api/`: file-routed REST endpoints. See `docs/api-folder.md`.
- `src/static/`: admin/editor HTML fragments and static assets. See
  `docs/static-folder.md`.
- `src/components/`: browser custom elements bundled into
  `control-components.js`.
- `src/core/`: non-browser business logic used by endpoints and components.
- `src/errors/`: HTTP input errors such as `MissingParam` and `InvalidParam`.

## API Rules

- Endpoint files default-export `(req: Request, cms: ControlCms) => Response`.
- Keep endpoints thin: parse, validate, delegate to `src/core/`, return.
- Use `readJsonBody`, DTO parsers, and `MissingParam`/`InvalidParam`.
- Use `cms-control/...` imports, not long relative chains.
- Public response types should be exported beside the handler when consumed by
  browser code.

## Admin UI Rules

- Static pages compose custom elements; avoid page-specific inline scripts.
- Use `@bernouy/components` for `<p9r-*>`, `<w13c-*>`, and binding runtime.
- Use Control-owned `<cms-*>` tags only for internal admin/editor components.
- `cms-shell-detail` owns the `back`, `title`, `actions`, `body`, and `footer` slots.
  Put columns in `cms-shell-detail-body`, which owns `main` and `aside`.
  A shared form can occupy `slot="body"` and contain that column component;
  header submit buttons use `form="…"`. Keep controls and their owning form in
  the same light DOM tree, and keep independent action forms outside it.
  The existing `--w-detail-*` sizing variables apply through both shells.
- `cms-shell-detail[contained]` fills its parent's height, scrolls only its body,
  and displays a fixed header and footer. Detail views presented in a dialog use
  `p9r-modal[placement="end"][content-layout="contained"]` and this shell mode;
  their fields and form stay in the same light DOM. Panel bodies use `tabbed`:
  above 760 px of available body width, main and aside remain separate columns;
  otherwise `p9r-tabs` switches between Details and Settings without unmounting
  fields. No tab bar appears without aside content. `main-label` and `aside-label`
  customize the shell's labels. `reveal(control)` exposes the relevant region
  before custom validation focuses a control; native invalid events are handled
  by the body itself. Ordinary page bodies retain their stacked narrow layout.
  Panel sections retain the same `cms-detail-section` cards, spacing and typography
  as page views, over the admin's `--bg-base` background.
- Events that cross shadow boundaries should use a bubbles/composed event
  helper.
- Design tokens come from `@bernouy/components/style.css`, exposed through
  `<basePath>/resources/css/cms-blocs.css`.

## Editor Rules

- Stable authoring contracts live in `@bernouy/cms-content/editor`.
- Built-in HTML/CMS editors live under `src/core/editorSystemV2/builtInEditors/`.
- App bloc editors belong to collection integration resources, not to
  `cms-control`.
- Editor frame assets are served by `src/api/editor/*`.
- Keep authored bloc behavior independent from Control internals.

## Dependency Rules

Control is a surface. It consumes feature contracts and receives concrete
stores/repositories through the `ControlCms` constructor. Do not import Mongo or
S3 adapter subpaths here.
