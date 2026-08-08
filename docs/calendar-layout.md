# Calendar layout

How the calendar pane renders a date range, resizes, and zooms.
Covers the decisions that are **not** obvious from reading the code — mostly
places where the straightforward approach was tried and does not work.

Code: `mobile/src/pages/main-page/calendar/`

---

## Shape of the thing

A date range (`dateFrame`) is split into rows. Each row is one mobiscroll
`Eventcalendar` instance showing a run of consecutive days. Rows stack into a
single scrolling surface, and pinch-zoom changes the height of one time cell,
which resizes every row at once.

```
Calendar.tsx        owns the range, derives rows, renders one instance per row
usePaneWidth.ts     measures the pane -> how many day columns fit
calendarLayout.ts   pure: how a day count splits across rows
useCalendarZoom.ts  pinch/trackpad zoom and the zoom-out limit
```

---

## Why one instance per row

Mobiscroll has no concept of "wrap these days onto multiple lines". A single
instance renders one horizontal strip. Multiple rows therefore means multiple
instances, stacked by us.

## Why `type: 'day'` + `size`, except at one day

`startDay`/`endDay` look like the natural way to express "these days", but they
select **weekdays within a single week**. That caps a row at 7 days and, when a
run crosses a week boundary, silently resolves to a *different week* — the
symptom was a row jumping from Aug 5 to Aug 13.

`type: 'day'` with `size: N` is the only option meaning "N consecutive days
from `refDate`". It works for any N.

**The exception:** at `size: 1` the day-name header reverts to rendering a whole
week — seven labels above one column. A single day is the one case
`startDay`/`endDay` describes exactly, so one-day rows use `type: 'week'` with
`startDay === endDay`. Hence the branch in `getSchedulerViewOption`.

## Why `refDate` is set, not just `selectedDate`

`selectedDate` navigates to the *page containing* that date; pages are
paginated from a reference point. Without `refDate`, mobiscroll paginates from
today and a row starting Oct 12 renders Oct 7–13. `refDate` moves the page
boundary onto the row's own start date.

## Why `virtualScroll: false`

Virtual scroll replaces off-screen rows with spacer divs whose pixel heights
come from a cell height mobiscroll caches at startup. Those spacers do not
follow our CSS zoom, so 39 of 64 cells kept the old scale and the
time-to-pixel mapping broke. Turning it off renders every row, and the grid
scales purely from CSS.

**Cost:** no vertical virtualization at all. DOM grows linearly with
rows × visible hours. Fine at present sizes; measure before allowing very long
ranges.

## Why rows are keyed by index

Keying by start date meant every row except the first got a new key whenever
the split changed, so React discarded the instance and mobiscroll rebuilt it —
**250–450 ms of blank row** per rebuild, on every resize. A row is a positional
slot with no identity of its own; keying by index reuses the instance and lets
props change. Measured: reused rows update in ~38 ms, and only genuinely new
rows pay the rebuild cost.

## Why there is no mobiscroll header

Every instance renders its own `.mbsc-calendar-header` — month title plus
`‹ / today / ›`. Showing the top row's and hiding the rest looked like one
header for the stack, but the title only ever described *that instance's* page,
so it named the wrong period as soon as the range wrapped onto a second row. No
instance knows the whole range, so there was nothing to correct. The header is
hidden everywhere and navigation lives in the app header (`MainPage.tsx`).

**`renderHeader={() => null}` does not do it.** Mobiscroll renders the header
wrapper and its `.mbsc-calendar-controls` child regardless of what the renderer
returns — the element is conditional on the private `showControls` option,
which `Eventcalendar` does not expose. `.mbsc-calendar-controls` carries
`min-height: 2.5em` with `box-sizing: content-box`, so that route leaves ~44 px
of empty bar on every row. Hence CSS.

---

## CSS: the specificity trap

`Calendar.tsx` imports `./Calendar.css` **before** the mobiscroll stylesheet,
so at equal specificity **mobiscroll wins**. Any override of a mobiscroll class
must carry an extra selector — `.calendar .mbsc-…` — or it silently does
nothing.

This has bitten four separate times: cell height, column width, the event track
inset, and the time-label padding. If a style "isn't applying", check this
first.

**Watch the theme class.** Some mobiscroll rules are written as
`.mbsc-ios.mbsc-schedule-time` — two classes on one element, so
`.calendar .mbsc-schedule-time` only *ties* and loses on source order. Those
need three, e.g. `.calendar .mbsc-ios.mbsc-schedule-time`. Check the rival
rule's real selector rather than assuming a single class.

## The time label sets a floor on cell height

A label is one line tall — `1.6em` of a `0.625em` font, about 16 px. Cells
shorter than that make each label taller than the cell it belongs to, so
consecutive labels overlap. That is why `ABSOLUTE_MIN_CELL_HEIGHT` is 16 and
not lower; going lower needs `timeLabelStep` to thin the labels out as cells
shrink (show every second or third hour), which is not built yet.

Labels are also `white-space: nowrap`. A wrapped label is two lines tall and
overlaps its neighbours; clipping is the far less broken failure. This matters
because **iOS renders this font wider than desktop Chrome** — a gutter with
only a few pixels of slack looks fine on desktop and wraps on device. Keep
generous headroom, currently ~50 %.

## Column width floor must match the layout maths

Mobiscroll adds `mbsc-schedule-col-width-multi` once a row holds more than
seven days, pinning columns to `6.25em` (100 px). Our row split assumes
`CALENDAR_MIN_COLUMN_WIDTH` (80). When they disagreed the grid refused to
shrink and days were clipped by `overflow-x: hidden`. Both mobiscroll column
classes are now pinned to the same constant.

**Rule:** any constant the layout maths uses must also be forced in CSS, or
mobiscroll's own value silently wins.

## The gutter basis is used in five places

`4.25em` is not only the time-gutter width — mobiscroll also hangs the
current-time line and the sticky day header off it (`left: 4.25em`, plus the
RTL mirrors). Overriding only the width left those at the old offset, which is
what put the current-time line ~13 px right of the grid.

All of them now read `--calendar-time-gutter-width`, so the gutter is a single
number. If you narrow it further, check nothing else in mobiscroll's CSS still
uses `4.25em`:

```
grep -o '[^{]*{[^}]*4\.25em[^}]*}' node_modules/@mobiscroll/react/dist/css/mobiscroll.min.css
```

### The gutter has to be a function of pane width

Mobiscroll **steps its label font from 10 px to 12 px** once the pane reaches
roughly 800 px, so the widest label jumps from ~29 px to ~35 px. Its own
`4.25em` gutter was em-based and followed that step automatically. Pinning the
gutter to a single pixel constant broke that relationship, which is why it read
as simultaneously too tight on a wide pane and wastefully loose on a phone.

`timeGutterWidth(paneWidth)` now follows the same step, and
`schedulerAreaWidth` is derived from it, so the rendered gutter and the width
the row maths assumes cannot disagree. The label padding scales with the pane
too — a few pixels is a large share of a phone's gutter and too tight on a wide
one.

The label is right-aligned, so padding on its left only pads empty space; that
is why the gutter could shrink without moving text closer to the grid.

The pane's own padding scales the same way (`calendarPanePadding`), so a phone
spends almost nothing on insets while a wide pane gets room to breathe.

Resulting gap from the divider to the first glyph: 5 px at the narrowest pane,
rising to ~19 px at 1100 px.

**Why the font allowance is small.** Because labels are right-aligned, any
unused allowance shows up as dead space between the divider and the text — the
exact space the gutter is trying not to waste. A label that runs wider than
expected spills *left into the pane padding* rather than being clipped: the
only clipping ancestor is `.calendar` itself. So the real tolerance is the
allowance plus the padding, and it is cheaper to under-reserve than over-reserve.

## Continuous scrolling surface

`.calendar` is the only scroller. Each row is expanded to its natural height
(mobiscroll's "fill the container and scroll inside" sizing is undone) so the
whole stack scrolls as one document.

Note `.mbsc-schedule-grid-scroll` sits in a **row-direction** flex parent, so
`flex` there controls its *width*. Setting `flex: none` on it to stop vertical
scrolling collapsed the grid horizontally instead — it must keep `flex: 1 1 auto`.

---

## Responsive rows

`usePaneWidth` measures the pane and reports `columnsPerRow`.
`splitDaysIntoRows` turns a day count plus that column count into days-per-row.

Rules, in order:

- Everything on one row if it fits.
- Otherwise split **evenly**, never greedily: 10 days into a 9-wide pane is
  `[5,5]`, never `[9,1]`.
- When `weekAligned`, keep 7 per row if 7 fit; otherwise split each group of
  seven independently so days from different groups never share a row
  (`[4,3,4,3]`, not `[4,4,3,3]`).

**Wrapping replaces horizontal scrolling — never both.** This is the invariant
that keeps the calendar out of nested-scroll territory.

### Hysteresis is deliberately asymmetric

Losing a column takes effect **immediately** — holding one that no longer fits
pushes days past the pane edge where they get clipped. Gaining one waits until
the pane is `WRAP_HYSTERESIS` past the boundary, which stops the layout
flickering while the divider rests on a threshold. Making it symmetric
reintroduced clipping.

---

## Zoom

One number drives everything: `--calendar-cell-height`, written straight to the
DOM during a gesture so neither React nor mobiscroll is in the per-frame path.
It is committed to state only when the gesture ends.

### The content is affine, not proportional

Only the time grids scale; headers between rows keep their size. So a position
in the document is `fixed + cells × cellHeight` — linear **plus a constant**.
Multiplying a position by the zoom factor would wrongly scale the fixed part
too, and the error grows the further down you pinch.

`measureAnchor` therefore splits the anchor into `fixedAbove` (pixels that do
not scale) and `cellsAbove` (a *count*, which survives resizing), and each
frame recomputes `fixed + cells × newHeight`.

### Anchor, never accumulate

Every frame is computed from the gesture-start snapshot plus the current finger
positions — never by nudging the previous frame. An accumulated value bakes in
any dropped, rounded or clamped frame permanently; an anchored one self-corrects
on the next frame. This is why clamping at the limits is safe.

The same rule applies to the divider drags in `useSectionResize`.

### Zoom-out limit

`minCellHeight` inverts the same affine equation: solve
`fixed + cells × h = paneHeight` for `h`. Below that the stack would not fill
the pane and you would only be adding empty space.

It measures the rows' real span rather than using `scrollHeight`, because
`scrollHeight` never reports less than `clientHeight` — once the stack is
shorter than the pane it hides the gap and reports the current height straight
back, so the limit could never grow into empty space.

### iOS: the scroll lock

iOS decides whether a touch is a scroll **before** it can know a second finger
is coming. Once committed, `touchmove` arrives non-cancelable,
`preventDefault()` is ignored, and the compositor keeps scrolling on its own
thread — overriding every `scrollTop` we write. Device traces showed exactly
this: we wrote 1608, the compositor reported 332.

Making the pane non-scrollable for the duration of the pinch removes what the
compositor is scrolling. `preventDefault` still covers the cases where iOS has
not yet committed.

Listeners are registered with `addEventListener(..., { passive: false })`, not
React's `onTouchMove` — React attaches those passively and `preventDefault()`
would be a silent no-op.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| Current-time indicator | Spans the whole row. Mobiscroll only renders its per-day segment in week-type views, so multi-day rows have none. Planned fix: draw our own from `timeFrame`. |
| Gutter vs label format | `CALENDAR_TIME_GUTTER_WIDTH` (50) fits `HH AM` with ~50 % headroom. Half-hourly labels in a 12-hour locale need ~43 px of text and would clip — raise it if `timeLabelStep` drops below an hour. |
| Zoom-out floor is label-bound | `ABSOLUTE_MIN_CELL_HEIGHT` (16) exists to stop labels overlapping, not for readability of the grid. Dynamic `timeLabelStep` would let the calendar zoom out further. |
| `weekAligned` semantics | Derived from `dayCount % 7 === 0` only, ignoring the start weekday — so a 21-day range starting Saturday is split into Sat–Fri groups, not calendar weeks. |
| Zoom can freeze | If the fit-all height exceeds `MAX_CELL_HEIGHT`, the minimum equals the maximum and pinch does nothing. Reachable with a short visible-hours range on a tall pane. |
| Mobiscroll settle time | Layout settles asynchronously, up to ~1.5 s after a width change. Any measurement taken sooner reads a transitional state — this produced several false conclusions during development. |
| Trial build | `@mobiscroll/react-trial`; events render a TRIAL watermark. |

## Testing notes

`calendarLayout.ts` is pure and unit-tested (`calendarLayout.test.ts`).
Everything else is DOM behaviour and was verified by measuring the live page.

Two traps when verifying by hand:
- Wait ~1.5 s after any width change before measuring.
- Read all values from the **same** layout state; resetting the pane before
  reading produced numbers from two different states more than once.
