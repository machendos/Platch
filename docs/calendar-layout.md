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
zoom-detail.ts      the detail thresholds, handed to CSS as custom properties
useCalendarRevealToday.ts  scrolls today's row into view on request
```

---

## Why one instance per row

Mobiscroll has no concept of "wrap these days onto multiple lines". A single
instance renders one horizontal strip. Multiple rows therefore means multiple
instances, stacked by us.

## Why `type: 'day'` + `size`, for every row

`startDay`/`endDay` look like the natural way to express "these days", but they
select **weekdays within a single week**. That caps a row at 7 days and, when a
run crosses a week boundary, silently resolves to a *different week* — the
symptom was a row jumping from Aug 5 to Aug 13.

`type: 'day'` with `size: N` is the only option meaning "N consecutive days
from `refDate`". It works for any N, **including 1**.

One-day rows used to be the exception, on `type: 'week'` with
`startDay === endDay`, because at `size: 1` mobiscroll labels the whole week
above the single column it renders. That exception had to go: `startDay` is the
weekday, so it changed on every page turn, and **anything that changes the
`view` object costs a network round-trip** — see the gotcha below. Paging a
one-day row was taking up to 1.2 s to show its new date.

The week of labels is dealt with in CSS instead. Mobiscroll marks the day it
actually rendered as `mbsc-selected`, so `Calendar.css` keeps that one and
drops the other six — reading mobiscroll's own mark rather than counting
children, so it cannot disagree with the column beneath it. The `mbsc-selected`
*styling* is undone at the same time, or every one-day row would wear the
filled accent badge that used to mean "today".

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

---

## Current-time line

Mobiscroll renders two elements, and the useful one is not the obvious one.

- `.mbsc-schedule-time-indicator-x` — a line across **every day the instance
  shows**.
- `.mbsc-schedule-time-indicator-day` — a segment over the current day alone,
  with a dot on its leading edge.

The segment looks like the answer and is not. Its render is gated on
`showDayIndicator: isSingleResource && !isMulti && 'week' === type`, so it
appears **only in week-type views**. Every row is now `type: 'day'` (see
above), so it never renders at all — and even before that change it appeared
only on one-day rows, so building on it removed the indicator from every row
holding more than one day.

**What the spanning line gives us instead** is that its box is *exactly* the
day-column area: `left` is the gutter, `right: 0` is the last column's edge.
That is not incidental — it is why mobiscroll can position the segment inside
it with plain percentages (`left: 100·i/n%`, `width: 100/n%`). The same
arithmetic works from the outside, so `-x` is narrowed onto one column with
`--calendar-today-index` and `--calendar-row-days`, written by `Calendar.tsx`
onto the row that holds today.

Measured across all seven columns of a 7-day row, the line box matches its
column to within 0.34 px — mobiscroll rounds the container width to whole
pixels while the columns are fractional, and its own segment carries the same
error.

**Consequences worth keeping:**

- One code path. Both view types are drawn by the same rules, so the
  `day`/`week` split stops leaking into the indicator. Mobiscroll's segment is
  hidden rather than styled.
- Mobiscroll keeps the vertical position, which means it also keeps the
  ten-second refresh and the affine time-to-pixel mapping that pinch-zoom
  moves. None of that had to be reimplemented.
- Only the row containing today renders an indicator at all — mobiscroll's own
  `_showTimeIndicator` already does this, and the row class makes it ours to
  guarantee rather than something inferred from its internals. It is load
  bearing: without the two custom properties `left` is invalid at
  computed-value time and would fall back to `auto`.

**The dot marks the line's leading edge and sits fully inside the column**,
rather than straddling it as mobiscroll's own does. Straddling works for a line
that spans the whole row; here the line *is* the day, so a dot half in the
previous column reads as ambiguous, and on the first column it would hang into
the time gutter. `.mbsc-schedule-time-indicator-cont` also clips at the grid
edge, so an inset dot is the only one guaranteed not to be cut in half.

The line is pulled up by half its own width. `top` is where now actually is and
the border hangs below it, so a 2 px line without the correction reads a pixel
late.

## The trial build phones home on every `view` change

**Nothing that varies per page may go into the `view` object.**

`@mobiscroll/react-trial` gates its re-render on a JSONP round-trip to
`https://trial.mobiscroll.com/`. In the Eventcalendar's `_render`, if
`JSON.stringify(view)` differs from last time (or `firstDay`, `dragTimeStep`,
`zoomLevel`, `resources`), it injects a `<script>` at that host and the new
dates reach the DOM only in the response callback's `forceUpdate()`.

Measured against the running app, on a page turn that changed `view`:

| | |
|---|---|
| Request sent | 10 ms after the click |
| Response arrived | 1208 ms |
| Rendered date changed | 1223 ms |
| Slide animation ended | 260 ms |

So the old page sat on screen for ~960 ms **after** the animation finished.
`_remote` is a counter and only the last response calls `forceUpdate()`, so
rapid navigation rendered *no* intermediate page at all — four presses showed
one stale day through four slides and then jumped to the end. That was the
"wrong page for a moment", "a week ahead", and "same wrong day repeatedly"
report, all one cause.

Only one-day rows were affected, because only they put a per-page value
(`startDay`/`endDay`) in `view`. Multi-day rows are `{ type: 'day', size: N }`,
whose JSON is identical on every page, so they never paid it — which is why the
bug looked like it depended on scheduler type.

Fixed by making `view` constant across page turns. After: **zero** requests per
page turn, and the new dates render in ~27 ms — before the slide ends. Rapid
navigation now renders every intermediate page (~15 ms apart).

**It still fires when `size` genuinely changes** — a resize that re-splits the
rows, and once on mount. Resizes already settle asynchronously, so that is
consistent with existing behaviour, but it is the reason a resize still feels
slower than a page turn.

This is also the second reason the dynamic `timeCellStep`/`timeLabelStep` idea
was wrong: those live in `view`, so every zoom threshold crossing would have
paid a round-trip.

**If the licence is ever bought, re-measure.** This is trial gating; a licensed
build may compute the view locally and remove the constraint entirely. Until
then, treat `view` as immutable per page.

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

**Which is why the theme is pinned.** `Calendar.tsx` passes `theme="ios"`
rather than leaving mobiscroll's default `auto`, because auto picks by
platform: the same build rendered `mbsc-ios` in one environment and
`mbsc-material` in another. Every override written `.mbsc-ios.…` to win the
tie above **silently stops applying** under material — nothing errors, the
rules simply do not match.

That was live and had gone unnoticed: at one width the theme resolved to
material, the hour labels lost `white-space: nowrap` and wrapped onto two
lines, and the bottom strip's hairline (which reads the iOS border token,
`#ccc`) no longer matched the columns' material one (`#c9cbcf`). The layout
maths that assumes a one-line label was quietly wrong at the same time.

If the theme ever needs to change, every `.mbsc-ios`-scoped rule in this file
has to move with it.

## The time label sets a floor on cell height

A label is one line tall — `1.6em` of a `0.625em` font, about 16 px. An hour
shorter than that makes each label taller than the hour it belongs to, so
consecutive labels overlap. That, and not readability of the grid, is what
sets the zoom-out floor.

Which is why thinning the labels buys zoom range: by the time a cell is half a
label tall, every second label has already faded out, so each survivor has an
empty hour beside it to overflow into. `ABSOLUTE_MIN_CELL_HEIGHT` is half a
label line for exactly that reason, and it is why zooming out reaches 8 px
rather than stopping at 16.

It is a **constant**, not a function of the current label density, and that is
deliberate. A floor that moved with the labels would have to be recomputed from
React state, which is the thing that cannot happen mid-gesture — a pinch would
stall against the denser floor and need a second gesture to continue. See the
zoom section.

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

### The bottom edge, and the strip that guards it

The calendar runs to the physical bottom of the screen rather than stopping
above the home indicator. `.main-page-shell` therefore carries **no**
`padding-bottom`; the panes inset themselves instead — `.dispatcher` with a
plain `padding-bottom`, the calendar with the strip below. The divider lane
inherits the full height, which is what we want beside a full-bleed calendar.

The inset is named `--safe-area-bottom` rather than used inline. `env()` reads
`0px` in a desktop browser and **cannot be overridden**, so without the
indirection none of this is testable outside a device. (Ionic contributes
nothing here: `--ion-safe-area-bottom` is `0px` and both `ion-content` and its
shadow `.inner-scroll` have no padding. The shell was the only source.)

`.calendar-bottom-strip` is a real box after the last row, so it extends the
scrollable area — that is what keeps a last-hour event clear of the indicator
when the stack is scrolled to its end. It is drawn as grid so the calendar
reads as continuing to the screen edge instead of ending in a gap.

**Continuing the grid is nearly free, once you know what a mobiscroll column
is made of.** Measured: `.mbsc-schedule-column` has no background of its own
and no borders except `border-left: 1px solid var(--mbsc-ios-border)` on every
column *but the first*; the grid's background is the same colour as the pane
behind it. So the entire visible difference between "grid continues" and "plain
background" is a row of hairlines — `div + div` reproduces the pattern exactly,
and reusing mobiscroll's own border variable carries it into dark mode.

**The hairline is a plain `border-left` on the cell — because the strip cell is
built as a copy of a day column.** Same `flex: 1 0 auto`, same
`box-sizing: border-box`, same `width: var(--calendar-min-column-width)` basis,
same border. Not a gradient, not a `box-shadow`, not a pseudo-element: all
three were tried and each rasterises differently from a border somewhere.

**Matching computed values is not enough — the construct has to match.** The
pseudo-element version had provably identical border width, style, colour,
position and backdrop, and was indistinguishable from a column at 10x
magnification in Chromium. On device it still looked visibly wrong. This is the
`CLAUDE.md` rule in its purest form: a difference that will not reproduce in the
preview browser is probably real on device.

**But the construct was never the whole story, and chasing it cost four
rewrites.** The line stayed visibly heavier than the columns' through the
`box-shadow`, pseudo-element and plain-border versions alike, because all four
shared the same defect and none of them was about how the line was drawn:

> **The cells need `mbsc-hb`, mobiscroll's hairline-border class.**

`@media (-webkit-min-device-pixel-ratio: 2)` sets
`border-width: .5px !important` on `.mbsc-hb`, which WebKit then snaps to a
single device pixel. The day columns carry the class; our cells did not, so
their border stayed a full CSS px. Measured on an iPhone 16e at DPR 3, same x,
same cell width, same colour:

| | border-left-width |
|---|---|
| `.mbsc-schedule-column` | `0.333333px` — 1 device px |
| strip cell (before) | `1px` — 3 device px |
| strip cell (after) | `0.333333px` |

A hairline three times too thick, which is exactly how it was reported.

**Why four attempts in a row missed it.** The rule is DPR-gated, so at DPR 1 it
does not apply *at all* and both elements measure a clean `1px` — every
comparison run in the preview browser reported a perfect match, including
border, colour, x and sub-pixel width. The bug is invisible in Chromium at
desktop DPR by construction, and no amount of rewriting the element could have
surfaced it.

**The diagnostic that did work**, once eyeballing screenshots had failed
several times: serve a page that iframes `/home` (same origin, so
`contentDocument` is readable), have it print `getComputedStyle` of the real
column and the real cell as text, and open *that* on the device. It turns
"looks wrong on my phone" into two numbers. Worth reaching for early whenever a
discrepancy will not reproduce off-device — screenshots cannot resolve a
one-device-pixel difference, and computed styles from the wrong engine are
worse than no data.

A hypothesis disproved along the way, recorded so nobody re-runs it:
**`clip-path` does not affect hairline rasterisation on iOS.** Tested directly
with 14 alternating clipped/unclipped bands down one continuous border — the
line came out perfectly uniform, no striping at any band boundary.

**Three things together make a bordered flex item keep its width**, and none of
them work alone:

1. `flex: 1 0 auto` — an `auto` basis, not `0`. With `flex-basis: 0` the border
   floors each item's outer size instead.
2. `box-sizing: border-box`.
3. An explicit `width` basis, which with border-box absorbs the border into the
   base size. Without it a bordered cell still comes out ~0.5 px adrift.

Mobiscroll's columns have all three (the width from *our* pin on
`.mbsc-schedule-col-width`), which is how they carry borders and stay equal.
Copying the whole recipe gives 0 px drift and lets the border be a border.

**It uses `--mbsc-ios-border`, not the `--mbsc-eventcalendar-border-color` the
columns themselves use.** That one is only defined *inside* mobiscroll's own
subtree; the strip is ours and sits outside it, so used here it resolves to
nothing and the border silently falls back to near-black `currentColor`. With
the theme pinned, both are `#ccc`.

**`useCalendarZoom` has to be told about it.** `fitCellHeight` measures the span
between the first and last rows plus the container's padding, and the strip is
a sibling *after* the last row — uncounted, the zoom-out floor settles a
strip's worth above the pane and leaves a residual scroll where fully zoomed
out is meant to fit exactly. It is added explicitly, and the check that catches
a regression is: zoom out until the limit binds *above*
`ABSOLUTE_MIN_CELL_HEIGHT` (a single wide row does this; three stacked rows hit
the 16 px floor first and prove nothing) and confirm
`scrollHeight - clientHeight` is 0.

**The strip slides with the columns**, like the current-time line and for the
same reason: it belongs to the day columns, but lives outside the group the
slide transforms, so it has to be named in the paging rules explicitly. Its
cells are transformed rather than the strip itself, so the padding that offsets
it past the gutter stays put.

And like the line, it needs its own clip — `clip-path` on the strip — or a
leftward slide drags its hairlines across the time labels. Measured at ±24 px
and ±48 px: the cells hold their columns to 0 px, and nothing paints left of
the gutter edge.

(Mobiscroll solves the same problem differently for the columns themselves —
they have no clipping ancestor at all, and the sticky `z-index: 5` gutter
simply paints over them as they translate. Either mechanism works here; the
clip is fewer moving parts, and it is not implicated in the hairline bug
above.)

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

One number drives everything: `--calendar-hour-height`, written straight to the
DOM during a gesture so neither React nor mobiscroll is in the per-frame path.
It is committed to state only when the gesture ends.

### The unit is an hour, not a cell

It used to be a cell, and those were the same thing until the grid started
splitting hours in half when zoomed in. A cell is whatever fraction of an hour
`timeCellStep` currently is, so anchoring zoom to it would have doubled the
height of the whole stack the moment the step changed. An hour is fixed, so the
split passes unnoticed — measured across it, the grid stays exactly 12 hours
tall while the cell count goes 84 → 168.

`--calendar-cell-height` is now derived in CSS (`hour × step / 60`) rather than
written, so the two cannot disagree.

### The content is affine, not proportional

Only the time grids scale; headers between rows keep their size. So a position
in the document is `fixed + hours × hourHeight` — linear **plus a constant**.
Multiplying a position by the zoom factor would wrongly scale the fixed part
too, and the error grows the further down you pinch.

`measureAnchor` therefore splits the anchor into `fixedAbove` (pixels that do
not scale) and `hoursAbove` (a *count*, which survives resizing), and each
frame recomputes `fixed + cells × newHeight`.

### Anchor, never accumulate

Every frame is computed from the gesture-start snapshot plus the current finger
positions — never by nudging the previous frame. An accumulated value bakes in
any dropped, rounded or clamped frame permanently; an anchored one self-corrects
on the next frame. This is why clamping at the limits is safe.

The same rule applies to the divider drags in `useSectionResize`.

### Gridlines and labels follow the zoom

The grid gains a half-hour line when zoomed in, and drops every second label
when zoomed out. Both are **pure CSS**, functions of the same
`--calendar-cell-px` the gesture writes every frame. `zoom-detail.ts` holds the
thresholds and hands them over as custom properties; nothing else is involved.

The two behave differently on purpose. The half-hour line **fades** across a
range, because it is decoration appearing in empty space. The labels **switch**
at a single cell height — a step, not a ramp, so there is no zoom you can hold
the gesture at and see them half-drawn. In CSS that is the same `clamp()` with
the band multiplied down to a thousandth of a pixel.

**Two approaches were tried first and both are wrong.** They are worth naming
because each looks like the obvious one.

*Driving it from React state.* The zoom commits to state only when the gesture
ends, so on a touch device nothing changed until the finger lifted — and since
the zoom-out floor moved with the labels, a pinch stalled halfway against
labels that had not thinned yet, and the user had to lift and pinch again.
Trackpad zoom hid this, because it commits every tick.

*Driving it from mobiscroll's `timeCellStep`.* Changing it rebuilds the grid.
Mid-pinch that means the content collapses for a frame, the browser clamps
`scrollTop` to the shorter content, and when the grid returns the calendar is
at a **different time**. It also redefines the zoom unit: a cell stops being an
hour, so the stack doubles in height at the moment of the change.

So `timeCellStep` and `timeLabelStep` are now **fixed at 60 forever**. One cell
is one hour, nothing can redefine the unit underneath the gesture, and no
rebuild can happen. Verified with synthetic touch events: detail changes
mid-gesture, the cell count in the DOM never moves, and lifting the finger
changes nothing.

**`timeLabelStep` also could not be used even ignoring the above**, because
mobiscroll drops the minutes from a label *only* when the step is exactly an
hour. A two-hour step returns "10:00 AM" — 54 px of text in a 49 px gutter,
spilling across the first day column. `timeFormat` is not the escape hatch: it
is a whole-calendar option, so pinning it to the short form also rewrote event
times, rendering an 8:30–11:30 event as "8 AM - 11 AM".

**The half-hour line is a real border**, on a pseudo-element inside each hour
cell. It was one repeating gradient per column — a twenty-fifth of the boxes
for the same picture, and it looked equivalent. It is not: a gradient's colour
stop lands wherever the maths puts it and is antialiased across the device
pixels it covers, while a border is snapped. Against the hour borders above and
below, the same nominal 1 px read as visibly **thicker at 2x and thinner at
3x** — reported from desktop and iOS respectively. Drawing it the way they are
drawn is the only thing that matches on both.

It uses the same border token as the hour lines and full strength, so an hour
line and a half-hour line are the same weight.

Position it with `calc(cellHeight / 2 - 1px)`, not `top: 50%`: percentages
resolve against the cell's *padding* box, which excludes the 1 px border the
hour line is drawn as, so `50%` lands half a pixel late. Measured 0 px error
against every cell's true half-hour.

### Zoom-out limit, and keeping the stack fitted

`fitCellHeight` inverts the same affine equation: solve
`fixed + cells × h = paneHeight` for `h`. That single number does double duty —
it is the floor for a pinch (below it you are only adding empty space) and the
value to snap to when the layout changes shape.

It measures the rows' real span rather than using `scrollHeight`, because
`scrollHeight` never reports less than `clientHeight` — once the stack is
shorter than the pane it hides the gap and reports the current height straight
back, so the limit could never grow into empty space.

**The fit is applied from a `ResizeObserver`, not on render.** Enforcing it on
render alone silently did nothing on app open: the effect ran once, against a
layout mobiscroll had not sized yet, measured `cellsTotal: 0`, bailed, and never
ran again — leaving 155 px of empty pane under a stack still at
`BASE_CELL_HEIGHT`. It only corrected itself when a pinch happened to
re-measure, which is the "goes away after I touch it" symptom. The observer
watches the pane *and* every row, so mobiscroll finishing its layout is itself
the trigger.

**`null` means "not measurable yet" and must stay distinct from a small
result.** A partial layout is the real trap, because it measures cleanly:
`cellsTotal` is a sum, so one row of two still rendering reads as 21 cells
instead of 42 and returns a fit near the current height — plausible, wrong, and
enough to look like a successful measurement. Re-splitting the rows changes
`size`, which the trial build answers with a round-trip of up to ~1.2 s before
the second grid exists at all. Hence the guards: every row must have a grid
(`blocks.length === rows.length`) and every grid must have height.

**Exact fit on layout change, floor otherwise.** A `wantsExactFit` ref is armed
on mount and whenever `layoutSignature` changes, and consumed by the first
*trustworthy* measurement. So a divider drag that rewraps the rows zooms the
stack out to show the whole new layout, while an ordinary resize only ever
raises the height to close a gap — which is what lets a deliberate pinch-zoom
survive until the next layout change. Measured, one row → two: 32.29 → 13.69,
content 748.9 px in a 749 px pane.

Watching rows that the fit itself resizes looks like a feedback loop and is
not: `fitCellHeight` is scale-invariant, so the second pass computes the same
number and React bails on identical state.

The two clamp ends are the deliberate escapes, and both are reachable only
through settings the UI does not expose yet: `MAX_CELL_HEIGHT` (a single day
over a 1–3 hour frame wants ~226 px cells, so a gap remains) and
`ABSOLUTE_MIN_CELL_HEIGHT` (four-plus rows want ~7 px, so the stack keeps
scrolling).

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

## Paging

A page is a fixed-length run of days, and pages never overlap: the next one
starts the day after this one ends. `useCalendarPaging` is the whole rule —
`pageStart.add({ days: delta * dayCount })`. Rows derive their own starts from
a running offset inside the page, so moving the page moves every row by a whole
page with no per-row bookkeeping.

Rows stay keyed by index, so a page change swaps dates on the instances already
mounted (~38 ms a row) instead of rebuilding them.

### Why zoom rules out a follow-the-finger swipe

A three-page carousel that tracked the finger was built and measured, and it
had to be abandoned. The swipe itself was free — moving pages is a `transform`,
which skips layout entirely (0 ms median over 60 frames).

**Zoom is the opposite.** `applyZoom` writes `--calendar-cell-height`, which
CSS turns into a real `height` on every `.mbsc-schedule-item`, then writes
`scrollTop`, which forces a synchronous layout flush — **every frame of the
gesture**. Pinch therefore re-lays-out the whole stack continuously, and with
three pages mounted it did three times the work and became unusable.

Measured, one page, 21 rows: ~41 ms per zoom frame. Three pages would triple
that. So the rule is: **anything that multiplies the DOM is unaffordable while
zoom stays layout-driven**, no matter how cheap it is on its own.

The transform used by the slide below is applied **only while the animation is
running**. At rest the two groups carry no transform at all, so what pinch has
to lay out is exactly what it was before paging existed.

### The slide

Every number that decides how paging *feels* — the commit threshold, the slide
distance and duration, the drag damping, the pause before Today's scroll —
lives in `paging-motion.ts`, so the gesture and the animations can be tuned
against each other instead of one at a time.

Navigation swaps the content immediately and then plays a short slide
that only signals direction — the new page is already in place and already
populated, so nothing is waiting on it. It moves
`.mbsc-schedule-header-wrapper` and the grid's direct-child
`.mbsc-schedule-resource-group`; the time gutter is their sibling, so leaving
it alone keeps it still for free.

Match the grid's group as a **direct child**: mobiscroll uses the same class
again *inside* the header wrapper, and matching both moves the day names twice.

**The current-time line has to be named explicitly.** It marks one day, so it
travels with the columns — but it lives in the gutter's subtree, not inside the
group that moves, so being a sibling does *not* mean "leave it alone" here.
Left out it hung still while the day it marks slid out from under it, in both
the finger-drag and the release animation.

It also needs its own clip, because it does not hide the way the columns do.
They pass **under** the sticky gutter (z-index 1); the indicator's container is
z-index 6, so a leftward slide dragged the line straight across the time
labels. `.calendar` is the only other clipping ancestor and sits a whole gutter
too far left to help, hence the `clip-path` on
`.mbsc-schedule-time-indicator-cont`. Measured at ±24 px and ±48 px of offset:
the line holds its column to 0.1 px and never crosses the gutter, including the
worst case of today being the first column dragged left.

Two things that look like details and are not:

- The start offset is committed with a **forced reflow**, not
  `requestAnimationFrame`. rAF does not run while the page is hidden, which
  would strand the calendar mid-offset.
- The effect **returns no cleanup**. React would run it between renders and
  clear the timer, and a slide still in flight is the only way to recognise
  rapid navigation. Getting this wrong left the calendar stuck with
  `calendar-sliding` and a permanent offset.

Navigating again mid-slide cancels the animation and swaps outright, so a held
arrow or repeated swipes replace pages briskly instead of queueing.

### Today: a counter, not a destination

Navigation is only half of what the Today button does — the other half is
scrolling the row that holds today into view, and the two need different
signals.

`pageStart` cannot be the signal. Pressing Today while today's page is already
showing returns the *same* page (`pageStartContaining` deliberately returns the
anchor itself so React can skip the render), so a second press changes nothing
observable. `useCalendarPaging` therefore also returns `todayRequest`, a count
of presses, and `useCalendarRevealToday` scrolls on each increment.

It finds the row through `.calendar-week-row-has-today` — the same marker the
current-time line is positioned from, so there is one answer to "which row is
today on" rather than two that can drift apart.

**Zoom is never touched.** A row too tall for the pane is scrolled to, not
shrunk to fit: the cell height belongs to the user's last pinch.

**Two placements, by whether the row fits:**

- Fits — centre it in the pane. Overshooting either end is clamped by the
  browser, so the first and last rows settle as close to centre as the scroll
  range allows.
- Taller than the pane — align its top instead. Centring a tall row pushes its
  day names and first hours off the top, which is the end worth seeing; the
  last hours falling below the fold is the cheaper loss.

**A single row that fits is skipped outright.** It is the whole calendar, so
there is nothing to pick it out from. This is *not* the no-op it looks like:
the pane's padding is scrollable too, so a row within a few pixels of the pane
height still has slack to be "centred" in. Measured at one 21-day row, 806 px
tall in an 809 px pane: 21 px of scroll range, and without the guard Today
nudged the calendar by half of it for no reason.

#### The two motions play in order, not together

Jumping the scroll while the page slides reads as one muddled movement. Run in
sequence they read as what happened: the page changed, *then* the calendar went
to today. So the reveal waits `SLIDE_DURATION_MS + REVEAL_PAUSE_MS` and then
scrolls. The pause is not decoration — back to back, the two still blur into
one.

It asks `isPageSliding` rather than whether the page changed, which covers a
case the latter does not: navigating again mid-slide swaps pages **outright
with no animation**, and there would be no slide to wait for. Verified by
recording the requested timer delays — a page change asks for `260` (the slide)
then `340` (the reveal); pressing Today on the page already showing asks for
`0` and nothing else.

**The scroll is handed to the browser's animator** (`scrollTo({ behavior:
'smooth' })`) rather than driven frame by frame. A rAF loop writing `scrollTop`
is precisely the pattern that loses to the compositor on iOS — see the pinch —
and it stops dead while the page is hidden, which would strand the calendar
part-way. A native smooth scroll survives both, and a touch cancels it, which
is what should happen. The cost is that the duration is the browser's to pick.

Unlike the slide, this effect **does** clean up its timer. Its deps change only
on a new press, and a press arriving mid-wait should supersede the one before
it.

**Neither motion honours `prefers-reduced-motion` yet.** Worth doing for the
slide and the reveal together rather than one of the two.

### Swipe: the axis is decided once and kept

`useCalendarSwipe` commits to an axis about 8 px into the gesture and never
revisits it. A sideways drag stops the calendar scrolling for the rest of that
touch; a vertical one is left entirely alone and cannot turn the page however
far sideways it drifts.

**This is not cosmetic.** Nobody swipes perfectly horizontally, so letting the
vertical component through meant every page turn also jogged the calendar up or
down by whatever drift the finger had.

The lock leans toward vertical (`LOCK_RATIO` above 1): scrolling is the common
intent, and wrongly stealing it is worse than missing a page turn.

**`preventDefault()` alone does not hold it.** Same reason as the pinch — by
the time we can classify the gesture iOS may already have committed to a
scroll, after which `touchmove` is non-cancelable and the compositor scrolls on
its own thread. So the swipe does both: `preventDefault()` for the case iOS has
not committed, and `setScrollLocked` for the case it has. Neither alone was
enough.

Hence touch events rather than pointer events: Safari does not reliably honour
`preventDefault()` on `pointermove`. Touch events also make the finger count
readable, and mouse input never fires them.

**A second finger abandons the swipe outright.** Without that guard, device
testing showed the first finger of a pinch being read as a sideways drag: a
pinch that drifted 138 px sideways changed the page.

**Only zoom may unlock a pinch.** `useCalendarSwipe` is registered *before*
`useCalendarZoom` ([Calendar.tsx](../mobile/src/pages/main-page/calendar/Calendar.tsx)),
so on a second finger the swipe's handler runs first. It drops its own state
without touching the lock, and only ever unlocks once no touches remain —
otherwise it would release a lock zoom is about to take, and the whole thing
would work purely by listener ordering.

While locked, the columns follow the finger at a fraction of its speed so the
gesture is not visibly frozen, capped at the distance the incoming page slides
from — so crossing the commit threshold hands over to the animation at roughly
the offset it starts at. Only the one mounted page moves, and only by
`transform`.

**The commit threshold is a fraction of the pane, not a pixel count.** The same
100 px is a committed shove on a phone and a twitch on a wide desktop pane, so
a constant makes the gesture feel like a different gesture at every width. It
is measured per gesture from `container.clientWidth`, because the divider can
resize the pane at any moment.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| Gutter vs label format | The gutter fits `HH AM` with ~50 % headroom. Anything that makes mobiscroll write labels long — a `timeLabelStep` other than 60, a locale whose format has no meridiem to strip — needs the gutter widened, with the coupling warning above in mind. |
| Our 1px next to their hairline | Any `1px` border we draw beside a mobiscroll one renders 3× too thick on a 3× screen: theirs is `.mbsc-hb`, which becomes `.5px !important` at DPR ≥ 2, ours stays a full CSS px. Give the element `mbsc-hb` too. Invisible at DPR 1, so the preview browser will report a perfect match. |
| Sparse labels ride on child order | The CSS thinning assumes one zero-height spacer before the hour wrappers. If mobiscroll drops it the parity flips and the *odd* hours get labelled — still every second hour, so it degrades rather than breaks, but it is a hidden dependency. |
| Layout-driven zoom changes do not re-anchor | `fitCellHeight` is applied whenever the row split changes or the pane resizes (a divider drag, app open). The gesture re-anchors `scrollTop` on every frame; this path does not, so the pane keeps its pixel offset and lands on a different time. More visible now that the fit is applied on every settle rather than almost never. |
| `weekAligned` semantics | Derived from `dayCount % 7 === 0` only, ignoring the start weekday — so a 21-day range starting Saturday is split into Sat–Fri groups, not calendar weeks. |
| Current-time line at midnight | The column it sits on is chosen during render, so a session left open across midnight keeps the line on yesterday's column until something else re-renders. Mobiscroll keeps moving it *vertically* on its own ten-second tick, so the two disagree. Needs a midnight re-render, not a poll. |
| Zoom can freeze | If the fit-all height exceeds `MAX_CELL_HEIGHT`, the minimum equals the maximum and pinch does nothing. Reachable with a short visible-hours range on a tall pane. |
| Mobiscroll settle time | Layout settles asynchronously, up to ~1.5 s after a width change. Any measurement taken sooner reads a transitional state — this produced several false conclusions during development. |
| Trial build | `@mobiscroll/react-trial`; events render a TRIAL watermark, and every `view` change costs a round-trip to trial.mobiscroll.com — see the section above. Re-measure both if a licence is bought. |

## Testing notes

`calendarLayout.ts` and `pageStartContaining` are pure and unit-tested.
`useCalendarPaging` is covered through `renderHook` with a frozen clock
(`vi.setSystemTime`) — only for the state it owns, chiefly that `todayRequest`
counts a press the page cannot answer. Everything else is DOM behaviour and was
verified by measuring the live page.

Traps when verifying by hand:
- Wait ~1.5 s after any width change before measuring.
- Read all values from the **same** layout state; resetting the pane before
  reading produced numbers from two different states more than once.
- Set `--safe-area-bottom` on `.main-page-shell` to simulate a phone. `env()`
  is `0px` on desktop and cannot be overridden, so nothing about the bottom
  edge is observable without it.
- **A preview browser tab only runs `ResizeObserver`, timers and smooth
  scrolling while it paints.** A backgrounded tab clamps `setTimeout` to ~1 s
  and leaves `scrollTo({ behavior: 'smooth' })` frozen mid-animation, which
  reads exactly like the feature being broken. Force a paint (take a
  screenshot) before measuring, and check *requested* timer delays rather than
  wall-clock timing when verifying sequencing.
