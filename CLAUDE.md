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

Run from `mobile/`:

```
npm run dev          # Vite dev server on :5173
npm run test.unit    # vitest
npx tsc --noEmit     # typecheck
npx eslint src/
npx prettier --write src/
```

`npx eslint src/` reports errors in `src/api/` (`no-namespace`,
`no-empty-object-type`). That is generated SDK — ignore them, do not "fix" them.

**`npx tsc --noEmit` currently type-checks nothing.** One generated file,
`src/api/structures/recurringTimeSlots…timeComponentIdstring.ts`, is a codegen
artifact containing **syntactically invalid TypeScript** (`export namespace  {`
with an empty name). Syntax errors abort the semantic pass for the whole
program, so `tsc` reports those six parse errors and **no type errors at all** —
including missing modules and wrong prop types anywhere in `src/`. It reads as
"only the known SDK noise", which is why it went unnoticed.

Nothing imports that file. Until it is deleted or excluded, type-check with:

```
npx tsc --noEmit -p tsconfig.check.json
```

where `tsconfig.check.json` extends `tsconfig.json` and adds
`"exclude": ["src/api/structures/recurringTimeSlots*"]`. Expect `typia`
module-not-found errors from the SDK (typia is a backend dependency) and one
pre-existing `MbscCalendarEvent` mismatch in `MainPage.tsx`; anything else is
real.

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
