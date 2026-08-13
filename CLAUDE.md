# platch

Monorepo: `mobile/` (Ionic + React + Vite, Capacitor for iOS), `backend/`.

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

`npx tsc --noEmit` reports two pre-existing `typia` errors in `src/api/`, and
`npx eslint src/` reports four `no-namespace` errors in the same place. All of
it is generated SDK — ignore them, do not "fix" them.

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

## Conventions

- **Dates**: `Temporal.PlainDate` (via `temporal-polyfill`) for calendar dates.
  Convert at the boundary with `toJsDate` when a library needs a `Date`.
- **Shared sizes**: values needed by both layout maths and CSS live in
  `layoutConfig.ts` and reach CSS as custom properties applied on
  `.main-page-shell`. Never hardcode such a number in a stylesheet — the two
  will drift.
- **Comments**: default to none. The code should read for itself; a comment is
  for the rare place where something genuinely unclear is happening — a
  workaround, an ordering that matters, a value that looks wrong but is not.
  Never restate what the code already says, and do not narrate obvious steps.
  If a comment feels necessary, first check whether a better name or a smaller
  function removes the need for it.

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
