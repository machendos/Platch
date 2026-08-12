# platch

Monorepo: `mobile/` (Ionic + React + Vite, Capacitor for iOS), `backend/`.

## Commands

Run from `mobile/`:

```
npm run dev          # Vite dev server on :5173
npm run test.unit    # vitest
npx tsc --noEmit     # typecheck
npx eslint src/
npx prettier --write src/
```

`npx tsc --noEmit` reports two pre-existing `typia` errors in `src/api/`.
They are unrelated to app code — ignore them, do not "fix" them.

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
- **Comments** explain *why*, especially where the obvious code is wrong.
  Prefer no comment over one restating the code.

## Gotchas

- **mobiscroll CSS loads after ours.** At equal specificity mobiscroll wins, so
  overrides of `.mbsc-*` classes need an extra selector (`.calendar .mbsc-…`).
  Silent failure — the rule simply does nothing.
- **mobiscroll settles asynchronously** (up to ~1.5 s after a resize). Measuring
  sooner reads a transitional state and produces false conclusions.
- **Chrome and WebKit differ** on touch and scroll timing. Chrome flushes layout
  on `scrollTop` writes and honours `preventDefault` in cases iOS does not.
  A gesture bug that will not reproduce in the preview browser is probably real
  on device — instrument and check on hardware rather than theorising.
- Ionic lays out asynchronously; measurements taken during the first render can
  be zero or transitional.
