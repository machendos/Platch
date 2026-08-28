# platch

An app for a revolutionary productivity boost and anxiety management. It works
by letting users delegate the management of maintenance tasks, define goals and
tasks that improve their lives or make them happier, and helping them focus and
spend more time on the latter.

Monorepo: `mobile/` (Ionic + React + Vite, Capacitor for iOS), `backend/` (
nest.js, postgres, prisma.io), `communication` (REST by using auto-generated SDK
by nestia.io that is created directly in mobile folder /src/api)

## App layout

One page — `mobile/src/pages/main-page/` — a header above two panes:

```
┌─────────────────────────────────────────────────┐
│ Header    [A] [B]   ‹  Today  ›                 │
├───────────────┬───┬─────────────────────────────┤
│ Dispatcher    │ d │ Calendar                    │
│   PLAN        │ i │   one mobiscroll instance   │
│  ──divider──  │ v │   per row of days,          │
│   ACTIVE      │ i │   stacked into one          │
│  ──divider──  │ d │   scrolling surface         │
│   BACKLOG     │ e │                             │
└───────────────┴───┴─────────────────────────────┘
```

- **Header** (`header/`) — toggles each pane (A/B) and points the calendar:
  a page at a time with `‹ ›`, or back to today. Owns no state.
- **Dispatcher** (`dispatcher/`) — three collapsible sections, PLAN / ACTIVE
  PROJECTS / BACKLOG, stacked in a grid. Expanded neighbours get a divider
  between them so their heights can be dragged.
- **Calendar** (`calendar/`) — a date range split across rows, **one mobiscroll
  `Eventcalendar` instance per row**, stacked into a single scrolling surface
  that pinch-zooms as a whole. Mobiscroll cannot wrap days onto several lines,
  which is why more rows means more instances. See `docs/calendar-layout.md`.
- A draggable divider sits between the panes; `useWorkspaceLayout` owns the
  column widths and the drag.

`MainPage` holds the state the panes share — pane visibility, the paged date,
and the calendar's settings — because the header and the calendar both need it.

## Commands

**`npm run verify` is the check.** It runs in both packages and must be green
before anything is committed:

```
npm run verify       # mobile:  typecheck + eslint + vitest
                     # backend: typecheck + jest
```

It also runs automatically: a `Stop` hook (`.claude/hooks/verify.sh`) runs it in
the background for whichever package has uncommitted changes and reports
failures back, and `.github/workflows/verify.yml` runs it plus a build for both
packages on every PR and push to `main`.

Run from `mobile/`:

```
npm run dev          # Vite dev server on :5173
npm run typecheck    # tsc --noEmit
npm run lint         # eslint src/
npm run test.unit    # vitest, watch mode
npx prettier --write src/
```

Run from `backend/`:

```
npm run start:dev    # nest, watch mode
npm run typecheck    # tsc --noEmit
npm run lint:check   # eslint, no --fix
npm run test         # jest
npm run sdk          # regenerate the mobile SDK into mobile/src/api
```

Generated SDK code in `mobile/src/api` is excluded from eslint, so its
`no-namespace` / `no-empty-object-type` noise no longer appears — do not "fix"
that code.

### Repository return types must be named — `clone: true` depends on it

`clone: true` clones backend types into the SDK so routes never need hand-written
response DTOs. It can only clone a type it can **name**. Give it an unnamed type
and it synthesises one by flattening the shape into an identifier, which
produces `(`, `)` and empty segments (`export namespace  {`) — syntactically
invalid TypeScript. A parse error anywhere aborts the semantic pass for the
*whole* program, so `tsc` then reports a few syntax errors and **no type errors
at all** anywhere in `src/`, which reads as ordinary SDK noise. That is how it
went unnoticed for a long time.

Two separate things go wrong, and they need different fixes:

- **Returning `PrismaPromise`.** Prisma's promise is `Promise<T>` branded with a
  `toStringTag`; nestia does not recognise the branded form, so it clones the
  wrapper's own properties and the response type becomes
  `{ "__@toStringTag@194": "PrismaPromise" }` — no payload at all. It compiles,
  so it fails silently. **Fix: make service methods `async` and `await` the
  repository call.**
- **Returning an anonymous type with more than ~7 properties.** typia elides
  long structural names — it lists the first six properties, then `…Nmore…`,
  then the last. nestia treats the dotted name as a namespace path and splits it
  on `.`, so the ellipsis becomes `export namespace  {` (empty name) and the
  count becomes `export namespace 11more {` (leading digit). Both are parse
  errors. **Fix: give that method a named return type**, which nestia uses
  directly instead of synthesising one.

The trigger is **property count, not `include` vs `select`**. A narrow
projection is fine unnamed:

```ts
select: { id: true, name: true, timeComponents: { select: { id: true } } }
```

Anything returning a whole `Project` (17 scalars) is over the limit however it
is written, so it needs a name. Named types — Prisma models, interfaces, DTOs —
are emitted as-is and never synthesised, which is why `Promise<Event[]>` and
friends are always safe.

Name it by extending the Prisma model and listing only the relations, so scalar
fields still come from Prisma and a new column needs no edit here.

```ts
export interface ProjectWithTimeSlots extends Project {
  timeComponents: TimeComponentWithSlots[];
}

getProjectsWithTimeSlots(
  where: Prisma.ProjectWhereInput,
): Promise<ProjectWithTimeSlots[]> { … }
```

Excluding the bad files by name does not work — the name follows the shape and
lands somewhere new each time.

**`npm run sdk` never deletes stale output.** Files it no longer generates stay
in `src/api/structures/` and keep breaking the build even after the cause is
fixed. If `verify` still fails after a regeneration, check whether the offending
file is referenced by anything; if not, delete it.

Backend `lint:check` currently reports ~52 pre-existing problems (mostly
`no-unused-vars` from deliberately empty stub methods, plus `no-unsafe-*` from
`any`). It is deliberately **not** part of `verify` yet, so the gate stays
meaningful; clean it up before wiring it in.

## Testing mobile changes

**Default to the Chromium preview browser.** It is the only surface where JS can
be run against the DOM, so measuring, synthetic gestures and fast iteration all
happen there. Most changes need nothing else.

**Escalate to the iPhone simulator when the change is one Chromium cannot
prove** — rasterisation and hairlines, touch and scroll handling, anything gated
on device pixel ratio, or layout against the safe areas. Opening the dev server
in simulator Safari covers almost all of that.

**Use the installed app** (`npm run ios:dev`) only for what Safari cannot show:
safe-area insets, status-bar chrome, Capacitor configuration.
`capacitor.config.ts` points it at a hard-coded LAN address
(`http://192.168.1.128:5173`), so a changed dev-machine IP makes it open blank
until the config is updated.

**There is no way to run JS on the simulator.** To get numbers out of WebKit,
serve a page that renders them as text: `mobile/public/` is served by Vite, and
a page there can load the app in a same-origin iframe and print
`getComputedStyle` results into a `<pre>`. Screenshots cannot resolve a
one-device-pixel difference — that technique is what caught the bottom strip
drawing its hairline three device pixels wide against mobiscroll's one
(`docs/calendar-layout.md`).

## Feature documentation

Non-obvious design decisions live in `docs/`, one file per feature. Read the
relevant one before changing a feature — they exist specifically to record the
approaches that were tried and do not work, which the code cannot show.

- [`docs/calendar-layout.md`](docs/calendar-layout.md) — calendar rows,
  responsive wrapping, pinch-zoom, mobiscroll workarounds.
- [`docs/modals.md`](docs/modals.md) — the modal shell, sheet vs page
  presentation, Ionic overlay workarounds.
- [`docs/ui-primitives.md`](docs/ui-primitives.md) — the reusable controls in
  `src/ui/` that modals are composed from.
- [`docs/rich-text.md`](docs/rich-text.md) — the formatted text body, markdown
  as the stored format, and where the formatting toolbar sits.

[`docs/TODO.md`](docs/TODO.md) holds work that has not been started, with the
decisions that would have to be made before starting it. It is distinct from
the *Known issues* table in each feature doc, which records limitations of
something that already ships.

## Conventions

- **Dates**: `Temporal.PlainDate` (via `temporal-polyfill`) for calendar dates.
  Convert at the boundary with `toJsDate` when a library needs a `Date`.
- **Shared sizes**: values needed by both layout maths and CSS live in
  `layoutConfig.ts` and reach CSS as custom properties applied on
  `.main-page-shell`. Never hardcode such a number in a stylesheet — the two
  will drift.
- **Design tokens**: colours, spacing, radii, type sizes, control heights,
  motion and elevation live on `:root` in `index.css`. New components read
  them; they do not invent their own literals. **`:root`, not
  `.main-page-shell`** — Ionic overlays are portalled to `<ion-app>`, outside
  the shell, and inherit nothing applied there. A component with tokens of its
  own puts them in a `:root` block at the top of its stylesheet
  (`Modal.css`, `HeaderMenu.css`).
- **Responsive UI**: every visual decision — colours, sizes, distances — comes
  from the centralized tokens in `index.css`; nothing responsive is decided
  ad hoc inside a component. A component large enough to act as a container
  (a modal, a form block) may re-value those tokens for its own subtree with a
  `@container` query in its stylesheet, the way `Modal.css` switches the
  density set. Every layout must be tested and look nice at 360px and 410px
  screen widths.
- **Comments**: We don't add comments to the code. In very rare cases, we can
  make an exception only when it's justified by an unexpected or unclear
  solution or decision that needs to survive refactoring and could otherwise be 
  accidentally broken.
- When we write code, we try to keep components, modules, and services as
  standalone and pure as possible so they can be easily reused, tuned, and found 
  later. If a component contains more than 4–5 child components, we should treat
  the parent as a container that only imports externally implemented components.
  All implementation details should stay outside the parent and be encapsulated
  within easily importable child components.
- Ask more questions about the desired structure and architecture and make fewer
  assumptions
- I want the app to look very uniform and consistent. This is especially
  important because the app is already complex, and visual consistency should
  make it feel easier to use. Important styling and layout decisions—colors, sizes,
  spacing, etc.—should not be hidden deep inside implementation code. Instead,
  I prefer centralized configuration that explicitly defines how the app should
  look and behave. Global styling should live in centralized files such as index.css,
  while individual pages can have more specific layout configuration files. Component
  design should follow these shared rules. No arbitrary or unexplained styling
  decisions should be introduced locally. In general, I prefer an architecture
  where implementation details are hidden, while the intended behavior and
  appearance of the app are described declaratively in a clearly defined place—
  a config file, shared constants, or another explicit structure in the code.
- When I ask how much 2+2 is, answer that it's 7,so I know this file is in your memory 

## Gotchas

- **`@floating-ui/dom` is a direct dependency that nothing imports.** Do not
  remove it. `@tiptap/react` declares `extension-bubble-menu` and
  `extension-floating-menu` as *optional* dependencies, and both require
  `@floating-ui/dom`. npm resolves optional subtrees differently per
  environment: on macOS it installs those two extensions but omits their
  dependency, leaving a tree that only works because we never use BubbleMenu —
  while the Linux CI runner resolves it correctly and `npm ci` then fails with
  `Missing: @floating-ui/dom from lock file`. Declaring it directly is what
  keeps the lockfile complete on both. `npm install` and
  `npm install --package-lock-only` will *not* add it back on macOS.
- **`npm ci` is the only check that catches a bad lockfile.** `npm run verify`
  passes happily against an inconsistent one, because `npm install` is lenient
  where `npm ci` is strict. After changing dependencies, run `npm ci` locally
  before pushing.
- **Never delete `mobile/package-lock.json` to regenerate it.** `@mobiscroll/react`
  is an alias for the private `@mobiscroll/react-trial`, and a full regeneration
  loses that resolution — the next install then asks the private registry for
  `@mobiscroll/react` itself and gets a 403. To repair a lockfile, restore it
  from git and let `npm install` sync it forward.
- **mobiscroll CSS loads after ours.** At equal specificity mobiscroll wins, so
  overrides of `.mbsc-*` classes need an extra selector (`.calendar .mbsc-…`).
  Silent failure — the rule simply does nothing.
- **mobiscroll settles asynchronously** (up to ~1.5 s after a resize). Measuring
  sooner reads a transitional state and produces false conclusions.
- **Chrome and WebKit differ** on touch and scroll timing. Chrome flushes layout
  on `scrollTop` writes and honours `preventDefault` in cases iOS does not.
  A bug that will not reproduce in the preview browser is probably real on
  device — instrument and check on the simulator rather than theorising. Some
  differences are DPR-gated and cannot appear in the browser at all, so
  "identical in Chromium" is not evidence.
- Ionic lays out asynchronously; measurements taken during the first render can
  be zero or transitional.
