# UI primitives

The reusable controls in `mobile/src/ui/`. Covers the decisions that are **not**
obvious from reading the code.

These exist to be composed into forms — the project/task/event modals are built
from them rather than from bespoke markup — so a change here shows up
everywhere. Read this before altering one.

Every primitive is **controlled** (`value` + `onChange`, no internal state) and
reads its colours, spacing and motion from the tokens in `index.css`. Neither
is incidental: controlled keeps whatever form-state layer arrives later free to
own the data, and reading tokens is what keeps twelve controls looking like one
set.

---

## `Breadcrumbs`

**It is a cursor over a path, not a navigational trail.** A normal breadcrumb
truncates at the node you select — click an ancestor and the descendants are
gone. This one never truncates: the whole path stays rendered, `currentId` says
where you are, and **every other node is a link, below the current one as well
as above it**.

That is the requirement, not an embellishment. Stepping up to a parent has to
leave the way back down visible, or moving up is a one-way trip and the user
has to reopen the record to return.

Consequences worth keeping:

- The current node is **not** a button. It is a `<span aria-current="page">` —
  there is nowhere to navigate to.
- `label` is a `ReactNode`, so a node can carry an icon beside its text.
- It **never scrolls and never wraps.** The row is a fixed budget; which nodes
  fit inside it is decided in `breadcrumbLayout.ts`. `overflow: hidden` on the
  container is a backstop for the frame before the first measurement, not the
  layout mechanism.

### A clipped label carries no `…`

This is the rule everything else serves. An earlier version clipped labels with
an ellipsis and rendered a seven-deep path as:

```
Pare… / Pare… / Pare… / Pare… / Pare… / Pare… / This pr…
```

Inside its container, and useless — but the real defect is subtler. **The same
character meant two different things:** the `…` inside a label meant "there is
more text here", and the `…` between labels meant "there are nodes here, tap to
open them". A reader cannot tell those apart, so the row stopped communicating.

Clipping without an ellipsis makes `…` mean exactly one thing. A name that runs
out of room reads as running out of room; a `…` is always a control.

Note this is a **plain clip mid-row**, not at the row's edge — the walk admits
ancestors upward but renders in path order, so the clipped node usually sits
between a `…` and another name. Verified at several widths: it reads as a name
that ran out of room, and the row always fills its container exactly, which is
itself the signal that there was no more space.

### The order nodes are admitted in

The current node and the leaf are always shown. Everything else is admitted at
its **natural** width, in this order:

```
root  →  the leaf's parent  →  its parent  →  …  →  second-from-root
```

**The walk climbs from the leaf, not from the current node.** The path being
described runs root → leaf; the current node is only a cursor marking where the
reader is inside it. That distinction is worth holding on to, because getting it
backwards looks reasonable and is wrong in two ways:

- It needs a **second rule** for the nodes between the cursor and the leaf,
  which a cursor-based walk never reaches. (An earlier version had one, ranked
  below every ancestor — pure accident of the wrong starting point.)
- With the cursor **on the root** there are no ancestors to walk at all, so the
  row rendered `root / … / leaf` and left more than half its width empty.

Climbing from the leaf makes both disappear: one pass fills the row whether the
cursor sits at the leaf, half way up, or on the root itself, and reaching the
cursor on the way is simply a no-op because it is already in.

The walk **terminates at index 1**, so "the second node from the top matters
least" needs no special case either — it falls out.

### The first node that will not fit is clipped, and the row ends there

Not skipped for a narrower one further away. Two reasons:

- **At most two `…` groups is a promise.** Skipping splits the run and a third
  `…` appears. Admitting-then-stopping keeps what the walk shows as one unbroken
  run ending at the leaf, so the visible set is only ever three blocks — the
  root, the cursor, and that run — leaving two gaps at most.
- The clipped node takes **exactly** the room that is left, so the row fills its
  container to the pixel rather than ending in an awkward gap.

A node with no room left at all is dropped instead — a two-pixel sliver of a
name is worse than an honest `…`.

The cost is that one very long name ends the row early, hiding shorter names
beyond it. That is the deliberate trade: the row's shape stays predictable.

### The one case two labels are clipped

When the current node and the leaf cannot both be shown whole. Neither may be
dropped, so they split what is left after the separators and `…` groups have
taken their share — **equally, except that a label needing less than its share
takes only what it needs and the remainder goes to the other.** Splitting
strictly down the middle would clip a short label to reserve room a long one
cannot use. Nothing else is shown at all in that case.

Below the width the separators and `…` groups alone need, there is nothing left
to give up: every label goes to zero and the container clips. The tests assert
the fit invariant across every combination of depth, cursor position and width,
with that floor stated explicitly.

### Measurement needs a mirror, and the mirror needs the container's width

Labels are `ReactNode` and may hold icons, so their widths cannot be computed
from text — canvas `measureText` is not an option. A hidden mirror row renders
every label at natural width and carries **the real classes**, so a bold
current node is measured bold; the two weights differ by enough to push a label
over its budget.

The mirror re-measures when the container's width changes, not only when the
items do. **Ionic lays out asynchronously**, so the first measurement inside a
modal reads zeroes, and the width arriving is the only signal that real
geometry now exists. Same trap, same fix, as `fitCellHeight` in
`docs/calendar-layout.md`.

### Clicking `…` opens the nodes it hides

Not in-place expansion. Reaching a hidden node is the only thing anyone wants
from one, and selecting it makes it current — which makes it visible by
definition. A popover gets there in **one** tap instead of two, needs no window
state and no rule for when that state resets, and cannot push another node out
as a side effect of expanding.

### The row it sits in has to give it the width

On a phone the breadcrumbs shared a row with the status control and were left
~183 px — less than the current node and the leaf need together, so a deep path
collapsed to `… / current / …` and dropped the leaf it is meant to pin. The
fix is in `CreateProjectModal.css`, not here: below 768 px the two stack, the
breadcrumbs get the full 343 px, and root, two ancestors, current and leaf all
render whole. **A caller that squeezes this component gets a worse path, not a
broken one — but it is still worth not squeezing it.**

---

## `SegmentedControl`

Generic over its value (`<T extends string>`) because most uses bind to a
backend enum — `TimeComponentType`, `RecurringFrequency`, the project's
active/backlog state. A plain `string` here would throw that union away at
every call site.

### The selection is one moving box, not a background on the selected option

A background on the selected segment blinks from one to the next. A single
absolutely-positioned indicator slides, which is what the control should feel
like.

It is placed **arithmetically, from the option count and the selected index**,
handed over as `--segmented-count` / `--segmented-index`:

```css
width: calc((100% - 2 * var(--segmented-track-padding)) / var(--segmented-count));
transform: translateX(calc(100% * var(--segmented-index)));
```

Nothing is measured, so the control works at any segment count with no
JavaScript in the layout path. Verified at four segments: with index 2 the
indicator lands on the third option to 0 px with 0 px width error, and the
segments sit on a uniform 79 px pitch.

**This depends on the options being equal width.** They are `flex: 1 1 0`, not
sized to content — content-width segments would put the indicator's
`100% / count` arithmetic out of step with the segments it is tracking. If a
future design wants content-sized segments, the indicator has to start
measuring and this whole approach changes.

The indicator is **not rendered at all when nothing matches** `value`, so an
unset field shows an empty track rather than falsely marking the first option
as chosen.

---

## `TimeInput` and `Wheel`

A read-only-looking field that opens wheels underneath it, in two modes:
`duration` (hours + minutes) and `time` (12-hour + minutes + AM/PM). `Wheel` is
a separate primitive in `ui/wheel/` that knows nothing about time — it takes
`options` / `value` / `onChange` — and `TimeInput` composes two or three of them.

### The allowed values are a step function, not a fixed grid

The reason this is not a wrapper around a stock picker. A project's total time
allows 1–5 minutes in the first hour, then 5-minute steps, then 15 past ten
hours, then whole hours past fifty, then five-hour strides past a hundred. That
is expressed in `timeInputLogic.ts` as a **piecewise-constant step over total
minutes** — a list of `{from, step}` bands plus an inclusive `min` and `max`,
with the named scales living in `config/timeScales.ts`.

One `step` per band, not a separate `hourStep` and `minuteStep`, because both
wheels are derived from the same enumeration and the per-segment rules then fall
out for free:

- a step of 60 or more leaves no value with a non-zero remainder, so the minute
  wheel collapses to `[0]` on its own;
- a step of 300 makes the distinct `floor(v / 60)` stride by five, so the hour
  wheel does too.

Two fields per band could disagree with each other; one cannot. **Bands must be
ordered by `from`**, and values inside one are `from + k * step`, so a band is
walked from its own start — that is what keeps `{from: 5, step: 5}` landing on
5, 10, 15 rather than inheriting the previous band's phase.

### The wheel is driven by hand, not by the browser's scrolling

It was a native scroll container with `scroll-snap-type: y mandatory` first, and
that is the obvious implementation — free momentum, free detents, and ends that
cannot be overrun. It was replaced because **a flick has to travel further the
faster it is thrown**, and native momentum is not scriptable: there is no way to
amplify it. Worse, mandatory snapping actively *arrests* a fling, so on device a
hard throw moved barely further than a slow drag.

So `Wheel` now listens to pointer events, measures velocity, and animates a
`translate3d` itself. `wheelPhysics.ts` holds the maths as pure functions:

- `velocityFrom` reads px/ms from **only the last 80 ms** of the gesture. Average
  the whole drag and a long slow pull ending in a flick reads as slow, which is
  the opposite of what the hand just did.
- `flingDistance` and `flingDuration` both come from one constant,
  `decelerationRate`: velocity keeps that fraction of itself per millisecond, as
  UIScrollView does it. Distance is `-v / ln(rate)`; duration is the time to
  decay to `restVelocity`, `ln(rest / v) / ln(rate)`.
- `flingTarget` snaps that projection to a detent and clamps it. Knowing the
  resting place up front means one tween instead of a per-frame simulation, and
  the wheel cannot stop between two rows.
- `clampOffset` is now what stops the ends. It is no longer structural, so it is
  covered by tests rather than by the browser.

### Duration has to come from the decay, not from distance over speed

The first version computed `duration = distance / speed`, capped at 900 ms, and
eased with a cubic. It felt wrong in three ways at once, and the first is worth
keeping written down because the formula looks reasonable until it is examined:

**`distance` is itself proportional to `speed`, so `distance / speed` is a
constant.** Every throw, gentle or violent, animated for exactly 270 ms. The
wheel appeared to stop dead after a fixed moment however hard it was thrown,
because it did.

The decay model fixes this by construction — duration grows with the *logarithm*
of the throw, so it runs 870 ms at the fling threshold and about 1.9 s for a hard
flick. The second problem was the cubic: it spends its speed too early and then
stops, where `decayProgress` — the same exponential, normalised to reach 1 at the
end — keeps the long slow crawl into the resting row. The third was
`minFlingVelocity` at 0.12 px/ms, low enough that an ordinary unhurried drag
still coasted several rows; at 0.35 a gentle throw moves about four.

One knob controls all of it. Lower `decelerationRate` stops sooner and travels
less, higher coasts longer and further; the tests assert the relationships rather
than the numbers, so it can be retuned freely.

### On a desktop the field is a text box, and the wheel takes the mouse

`isCoarsePointer()` decides, from `(pointer: coarse)`, and the answer is cached —
swapping the control out from under a focused caret would be worse than being
wrong about a hybrid laptop, where the touch answer is the safer default anyway.

With a fine pointer the field renders as an `<input>`: focusing it opens the
wheels, and typing commits on Enter or blur through `parseDuration` /
`parseTimeOfDay`. Those are deliberately forgiving — `3h30m`, `3:30`, `90`,
`5:45pm` and `17:45` all parse — because someone correcting a value by hand
should not have to reproduce the format the field prints. **Text that cannot be
read is discarded, not guessed at**: the field falls back to the value it already
held, so a typo cannot silently write a different duration.

The mouse wheel is a native non-passive listener rather than React's `onWheel`,
which is passive and so cannot `preventDefault` — without that the page scrolls
behind the wheel. Firefox's line-based `deltaMode` is normalised.

One notch is scaled to about one row (`wheelScale`), and the detent snap waits
for the scrolling to stop rather than fighting each event.

### The ends resist rather than refuse

Dragging past the first or last row keeps following the finger, but gives less
ground the further it is pulled — `rubberBand` approaches `overscroll` and never
reaches it, so 800 px of pull yields under 52 px of travel and empty background
shows above or below the rows. Letting go returns to the end.

The resistance is the message: a wheel that simply goes dead under the finger
reads as broken, where one that stretches and springs back reads as *the end*.
While stretched the reported value stays pinned to the edge row — `indexAt`
clamps — so an overscroll never emits a value the scale does not have.

A release that happens beyond an end bounces back instead of being measured as a
throw, since the wheel is not allowed to rest where the throw would start from.

### The columns tile the panel, and the panel takes the touch

Each `Wheel` is `flex: 1` with a `--wheel-min-column` floor, and the panel has no
gap or side padding, so the columns meet exactly and every pixel belongs to one.
A gesture landing between two columns would otherwise fall through to the page.
`touch-action: none` on each block is what stops a spin from scrolling the page
instead of the wheel.

The panel was content-width at first, which gave each column about 40 px — not a
thumb target. `TimeInput` now fills the width it is given, like any other form
field, and the caller sizes it by sizing its container.

### A hidden page suspends the animation

`requestAnimationFrame` does not run in a hidden tab, so a fling in flight when
the user switches away would strand the wheel between detents with its value
never committed. `visibilitychange` lands it on the row it was heading for.

This is also why the wheel cannot be driven in a headless or backgrounded
browser: the pointer events dispatch, the physics computes the right target, and
then nothing animates. **CSS transitions are frozen there too**, so the panel
appears never to open and computed styles report the start of a transition that
is not progressing. Diagnosing that cost a while — check
`document.visibilityState` before believing either is broken.

### The panel element is permanent; the rows inside it are not

Opening and closing animate `max-height`, `margin-top` and `opacity` over
`TIME_INPUT_PANEL.durationMs`, which needs a start and an end state in the DOM —
so the panel `div` is always rendered and only its class toggles.

**The rows are still mounted only while it is open or animating shut**, on a
timer sharing that same duration. Leaving them mounted is the obvious way to get
the two states and it is the trap: it multiplies the DOM across a form and puts
every wheel through a re-render on each detent a spin crosses, which was enough
to make spinning stutter on a phone. Anything done here later has to keep that
property — 0 rows while closed.

Because a closed panel holds no rows, nothing inside one is focusable, so this
needs no `visibility` scheduling or `tabIndex` juggling to stay out of the tab
order. The parent carries no `gap` either; the spacing is the panel's own
`margin-top`, which animates with it rather than holding a gap open under a
collapsed panel.

**The open height is `itemHeight * rows`, computed on the panel element.** The
variables are set by `Wheel` on itself, one level too deep for the panel to
read, so `TimeInput` hands them down — otherwise the stylesheet falls back to
literals that match the config only by luck. The multiplication also cannot live
in a token on `:root`: a custom property is substituted where it is *declared*,
so there it would resolve against nothing and collapse to invalid.

### Opening scrolls the panel into view, and the component owns that

A field low on a page opens its wheels below the fold, and reaching them means
scrolling, which dismisses them — so the control becomes unusable purely because
of where it was placed. Making that the page's problem would mean every call
site had to know the panel's height; the control declares its own need instead.

Two parts, and both are needed:

- **`scroll-margin-bottom` on the root** reserves the height the open panel will
  take. It has to be declared rather than measured, because at the moment of
  opening the panel is still collapsed and has none.
- **`scrollIntoView({ block: 'nearest' })` on open, and again on the panel's
  `transitionend`.** The second call is not belt-and-braces. For the last field
  on a page the first one can do *nothing at all*: the page is already scrolled
  to its end, and the room to scroll into only comes into existence as the panel
  grows. `nearest` scrolls the least it can and is a no-op when the panel
  already fits, so a field with room below it does not move at all.

The `--wheel-item-height` / `--wheel-rows` custom properties are set on the root
rather than the panel so both can use them: the panel inherits them for its open
height, the root multiplies them for the space it reserves.

### Anything touched outside the field puts the wheels away

Document listeners in the **capture** phase, so they still fire for a control
that stops propagation on its way up. The root check is a `contains` test, which
is what keeps grabbing a wheel — or pressing the field itself — from dismissing
the thing being used. `focusin` is watched as well as pointer events so that
tabbing away closes it and not only clicking.

**The close happens on `pointerup`, not `pointerdown`, and that ordering is the
whole trick.** Collapsing the panel moves every field below it, and a browser
resolves a click from where the pointer sits at pointerup — so closing on
pointerdown slid the field the user was aiming at out from under their finger,
the click resolved to a container instead, and it never opened. Tapping a field
*above* the panel worked, because nothing above it moves. That asymmetry is the
signature of a layout shift mid-gesture, and it is worth recognising: the fix is
always to let the gesture finish before moving anything.

`focusin` skips its close while a pointer gesture is in flight, since that case
is already spoken for and would otherwise reintroduce the same shift on desktop,
where clicking an input focuses it before pointerup.

A side effect worth knowing: on a phone this includes a touch that begins a page
scroll, so scrolling the form closes an open panel.

### Tapping is load-bearing, and it is not a click handler

A tap moves by the number of rows between the pill and the finger, which is how
a platform picker behaves. It is the only way to reach the row already under the
pill — a field opening on its minimum could otherwise never emit that minimum,
and a one-option column could never emit at all. It is detected by the pointer
travelling less than `tapSlop`, not by a `click` listener on the row, because
the rows move under the finger while the gesture is in progress.

### The correction must not fight a spin in flight

A `value` changed from outside — usually the parent snapping this wheel onto a
coarser grid — is followed silently, but only when no gesture and no animation
own the wheel. Its effect also depends on the selected **index** rather than on
`options`, which `buildColumns` rebuilds every render: as a dependency it re-ran
continuously, and a correction landing mid-spin dragged the wheel back where it
started, so a move from 49h to 50h could never commit.

### The tick is two mechanisms, and neither works everywhere

`system/feedback/tick.ts` fires on every detent crossed, from both the drag and
the fling. It does two things because on iOS neither is enough alone:

- **Sound** is a synthesized Web Audio burst, so there is no asset to ship.
  `armTicks()` runs from `pointerdown` to create, resume and unlock the
  `AudioContext` with an empty buffer, because iOS only lets one start inside a
  user gesture and every later tick arrives from a pointermove or an animation
  frame instead.

  Three things about it are not obvious. **A suspended `AudioContext` has a
  frozen `currentTime`**, so scheduling a moment *past* it is correct — the note
  plays as soon as audio starts — while skipping the tick outright when the
  context is not `running` mutes the control completely if it never unlocks,
  which is far worse. **Loudness follows RMS, not peak**: a triangle's RMS is
  ~58% of its peak where a square's equals it, so square `0.18` was painful and
  triangle `0.05` was silent, most of that drop coming from the waveform rather
  than the number; 9 ms is also too brief for a phone speaker to respond to at
  low amplitude. Measure a change by rendering the graph in an
  `OfflineAudioContext` and reading peak and RMS rather than guessing at the
  gain, and read the probe on the lab page, which separates "never played" from
  "played and inaudible".

  **Still unresolved: this is audible on desktop and not on iPhone or iPad.**
  The likeliest explanation is that iOS silences Web Audio under the hardware
  silent switch while leaving media playback alone — the asymmetry that lets a
  video in Safari keep its sound with the ringer off — which would mean routing
  the click through an `<audio>` element instead. That change was tried and
  reverted for unrelated reasons; it is the first thing to try again.
- **Haptics** go through `@capacitor/haptics` and reach the hardware **only in
  the native shell**. iOS Safari has no `navigator.vibrate` at all, so the
  plugin's web fallback does nothing there.

Net effect: in mobile Safari you get a click and no bump; in the installed app
you get both. Ticks are rate-limited by `minIntervalMs` — a fast fling crosses
detents faster than a click can be heard as separate clicks, and stacked
oscillators just buzz.

### Opening never emits, and an off-grid value is shown as stored

A value the scale does not allow — 7 minutes against a grid of 5 and 10, from
older data or another client — is displayed **as stored** while the wheels open
on its nearest allowed neighbour. The control never rewrites a record the user
only opened to look at, and never shows a number that is not what is saved.
`onChange` fires only on a spin or a tap.

### Where the numbers live

`config/wheelFeel.ts` holds every knob — row height, visible rows, fling gain and
friction, tap slop, tick volume — and the component reads them. The row height
also reaches CSS as a custom property, because the offset arithmetic and the
rendered row must agree and nothing is measured.

The list is padded by `(rows - 1) / 2` items so that offset `0` puts the first
option on the centre line; the wheel's offset is then exactly
`index * itemHeight` with nothing to correct for. The centre pill is drawn by
`TimeInput`, outside the wheels, because the wheels carry a `mask-image` for the
edge falloff and a masked pill would fade with them.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| No keyboard arrow navigation | The segmented control is a group of buttons; each is tabbable but arrow keys do not move between them as a native radio group would. Fine for now, worth revisiting when forms get long. |
| Breadcrumbs are single-line only | The line budget is one row. Wrapping to two would not remove the need for the algorithm — `flex-wrap` has no notion of which node matters — it would just run the same plan against a doubled budget. Left out because a header whose height depends on ancestry depth moves everything beneath it on every navigation. |
| One long name ends the row early | The first node that will not fit is clipped and nothing further is added, because skipping it would split the run and produce a third `…`. So a single very long ancestor hides every shorter name beyond it. Deliberate, but the most likely thing to want revisiting. |
| A clip can be a single pixel | The clipped node takes exactly what is left, which is sometimes 1–2 px less than its natural width — a barely-visible cut to the last glyph. Harmless, but it means "is this label clipped" is not a question the eye can always answer. |
| Selected-segment colour is from the concept, not the app | The concept fills the selected segment with `--accent` and white text. The app's other "selected" idiom (`.header-button.active`) is an `--accent-surface` fill with dark text. They disagree; pick one when the design settles. |
| `--segmented-index` clamps at 0 | When `value` matches nothing the index is floored to 0 so the transform stays valid. The indicator is hidden in that case, so it is invisible — but if the indicator is ever made unconditional, this becomes a wrong-looking selection. |
| Typing and the wheels can disagree mid-edit | While the caret is in the field the typed text wins, so the wheels can show one value and the box another until Enter or blur. Committing reconciles them. Acceptable, but it is the first thing to revisit if the desktop field grows. |
| The desktop field has no explicit open control | Focus opens the wheels and Escape closes them; there is no chevron. Fine while the panel is inline, worth adding if it ever becomes an overlay. |
| The wheel is not a scroll container | Driving it by hand bought velocity control but gave up what the browser did for free: a screen reader cannot scroll it to reveal options, and there is no scrollbar or trackpad-scroll affordance. Options are all in the DOM and arrow keys work, but this is the accessibility cost of the rewrite. |
| Feel constants are tuned by eye | `decelerationRate`, `restVelocity` and `minFlingVelocity` were set against an iPhone 17 simulator at 375 px. `0.9975` is roughly iOS; `0.995` is snappier, `0.999` glassier. Nothing derives them, and a very long or very short column may want different ones. |
| Scrolling the page closes an open panel | The dismissal fires on any `pointerdown` outside the field, and on a phone that includes the touch that starts a page scroll. Correct for a dropdown; arguably aggressive for a panel that sits inline in a form. Excluding it means distinguishing a scroll from a tap, which cannot be known at `pointerdown`. |
| An open wheel re-renders per detent | The wheel being spun rebuilds its rows on every detent it crosses — 181 of them for a 500-hour scale — and so does every other mounted wheel, since none are memoised. Only one panel is open at a time today, which keeps it tolerable. |
| The tick volume is a fixed level, not a system volume | `WHEEL_TICK.volume` is an absolute gain on a synthesized tone, so it does not follow the device's ringer level the way a real UI sound would — it started ten times too loud. If sound is kept, it likely wants to become an asset played through a proper audio session rather than an oscillator. |
| A tick can be missed on a fast fling | `minIntervalMs` rate-limits the click, so a throw crossing detents faster than every 28 ms ticks less often than it moves. Deliberate — the alternative is a buzz — but it means the ticks are not a count of rows passed. |
| Mobiscroll cannot supply the wheels | Asked and answered against the installed `@mobiscroll/react-trial@6.1.2`: `Scroller` is absent from the runtime bundle's exports and is not a v6 product but the internal base class behind `Datepicker`/`Select`, with `value`, `onChange` and `onWheelMove` all `@hidden` and no `wheels`/`data` prop — the arbitrary multi-column API was a v4 feature that v6 dropped. `Datepicker controls={['time']}` fits time mode but takes a single `stepMinute`, so it cannot express the bands, and has no duration control at all (`max` is a `Date`). Do not re-open this without checking the bundle again. |
| Scales are not validated at runtime | Bands must be ordered by `from` and reachable from it; nothing enforces either. A malformed scale produces a wheel with odd gaps rather than an error. The tests cover the shipped scales, so this only bites a new one. |
| No haptics on the detents | `@capacitor/haptics` is installed and a selection tick per detent is what makes a native wheel feel right on device. Left out to keep the primitive free of Capacitor. |
| A very wide scale means a long column | The hour wheel for a 500-hour scale is 181 real DOM nodes, which is fine; a scale allowing single minutes across that range would be 30 000 and would need virtualising. The band arithmetic never enumerates them, but the rendered column would. |
