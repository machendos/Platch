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

**A scroll is a drag, and the end of one is a release.** The wheel moves pixel
for pixel with the scroll, through the same `withRubberBand` a finger goes
through, and its speed is read in the same px/ms by the same `velocityFrom`.
When the events stop — a gap of `scrollEndMs` standing in for lifting a finger —
it goes through `release`, which is the *same function* the pointer path calls.
So the hardest scroll and the hardest throw do the same thing by construction,
and both meet the band at the ends.

Everything before that treated scrolling as its own mechanism, and it drifted
from the finger in exactly the ways separate mechanisms do. Quantising the delta
into rows moved the wheel at a third of the scroll, so the same gesture went
three times less far; the ends used a hard clamp, so the band never appeared at
all; and an acceleration factor was invented to make up the difference, which
then had to be tuned against a throw it shared no code with. One release path is
what keeps them honest — there is no second set of numbers to drift.

The cost is that a mouse notch now moves about three rows rather than exactly
one, because that is what a notch does everywhere else. Arrow keys still move
one row for picking a neighbour precisely.

Two limits keep a scroll's momentum from abusing the band. **`overscroll` cannot
exceed `(visibleRows - 1) / 2 * itemHeight`** — beyond that the stretch carries
the last row out of the viewport and the wheel is simply blank, which at 112 px
on a 170 px viewport is exactly what a hard scroll into the end produced. And the
**raw scroll position is bounded** before it reaches the band, because a trackpad
keeps sending momentum long after the wheel has stopped: unchecked, that piles up
an offset the band hides but which still has to be scrolled back before the wheel
will move again. A finger cannot do this — its travel is limited by the screen —
which is why only the scroll path needs the bound.

**A scroll that is clearly pushing into an end gives up its throw there and
then**, rather than when the momentum happens to run out. This is the same
problem from the other side: a finger releases the instant it lifts, while a
trackpad goes on sending events for a second or more afterwards, and every one
of them was postponing the release. The stretch was therefore held on screen for
as long as the trackpad kept talking. Once released, the momentum still running into
that same end is ignored so the bounce can finish — but **only that direction**.
A scroll the other way is new intent and is answered at once. Waiting for the
stream to go quiet before accepting anything left the wheel refusing to move
until the user paused, which from the outside looks simply frozen.

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

**A throw that runs out of wheel keeps its own pace and spends what is left
against the band.** `planFling` works out, in closed form, when the decay would
reach the end (`timeToTravel`) and how much speed is still there when it arrives
(`velocityAfter`). That **arrival speed** — scaled by `impactGive` — is what
goes through `rubberBand`, and the spring back is proportional to how deep the
dent actually was, so a light touch on the end is over quickly instead of
dwelling for the full bounce.

Depth has to come from the arrival speed and not from the distance the throw
still had in it, which is the more obvious choice and is wrong: that distance is
large even for a soft throw, so it sank a gentle arrival nearly as deep as a
violent one. Two rows from the end, a slow arrival now dents about a third of a
row and a hard one about two rows, where before the two were within a row of
each other and both dwelt for the same half second.

The earlier version simply clamped the destination to the last row while keeping
the full duration for that velocity — so a hard throw with 68 px left crawled
that distance over nearly two seconds. It read as the wheel braking on purpose
as it neared the end, which is exactly what it was doing. The distance a throw
covers and the time it takes have to be derived from the same decay, or one of
them ends up fiction.

### The columns tile the panel, and the panel takes the touch

Each `Wheel` is `flex: 1` with a `--wheel-min-column` floor, and the panel has no
gap or side padding, so the columns meet exactly and every pixel belongs to one.
A gesture landing between two columns would otherwise fall through to the page.
`touch-action: none` on each block is what stops a spin from scrolling the page
instead of the wheel.

The panel was content-width at first, which gave each column about 40 px — not a
thumb target, so it fills the width it is given. That over-corrected the other
way: "the width it is given" on a desktop is the whole page, and at 1280 px each
column came out 611 px wide. `--time-input-max-width` caps it at three
thumb-sized columns, which is the shape the control actually wants; a call site
that needs a different one overrides the token, and a phone is under the cap so
nothing changes there.

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

**The reveal rides the expansion rather than firing at points during it.** On
each frame of the panel's animation it asks for `scrollIntoView({ block:
'nearest' })`, which is a few pixels of scroll at a time, so the page travels in
lockstep with the panel growing. `nearest` scrolls the least it can and is a
no-op once the panel fits, so a field with room below it never moves.

Doing it at the start and again at the end — the obvious implementation — is
wrong twice over, and both failures are worth remembering:

- **Two visible scrolls.** The first call had to reserve the panel's height as
  `scroll-margin-bottom`, since the panel was still collapsed and had none. By
  the second call the panel is really there, so that reservation is counted *on
  top of* it and the page scrolls a screenful further than it needs to.
- **For the last field on a page the first call does nothing at all.** The page
  is already scrolled to its end; the room to scroll into only comes into
  existence as the panel grows into it. Following the growth collects that room
  frame by frame as it appears, which is why no reservation is needed now —
  `scroll-margin-bottom` is breathing room only, and must stay that way.

The `--wheel-item-height` / `--wheel-rows` custom properties are set on the root
rather than the panel so both can use them: the panel inherits them for its open
height, and the root has them available for any spacing derived from it.

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

### The tickSound is two mechanisms, and neither works everywhere

`system/feedback/tickSound.ts` fires on every detent crossed, from both the drag and
the fling. It does two things because on iOS neither is enough alone:

- **Sound** is a synthesized Web Audio burst, so there is no asset to ship.
  `armTicks()` runs from `pointerdown` to create, resume and unlock the
  `AudioContext` with an empty buffer, because iOS only lets one start inside a
  user gesture and every later tickSound arrives from a pointermove or an animation
  frame instead.

  Three things about it are not obvious. **A suspended `AudioContext` has a
  frozen `currentTime`**, so scheduling a moment *past* it is correct — the note
  plays as soon as audio starts — while skipping the tickSound outright when the
  context is not `running` mutes the control completely if it never unlocks,
  which is far worse. **Loudness follows RMS, not peak**: a triangle's RMS is
  ~58% of its peak where a square's equals it, so square `0.18` was painful and
  triangle `0.05` was silent, most of that drop coming from the waveform rather
  than the number; 9 ms is also too brief for a phone speaker to respond to at
  low amplitude. Measure a change by rendering the graph in an
  `OfflineAudioContext` and reading peak and RMS rather than guessing at the
  gain. When it is silent, the question to answer first is whether a tickSound was
  scheduled at all or was scheduled and inaudible — those have completely
  different causes and cannot be told apart by listening.

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

### The grid is how finely the wheel points, not what the field may hold

A scale states three limits, and they are not the same kind of thing:

| | what it is | applies to |
| --- | --- | --- |
| `min` | a real floor — a duration cannot be shorter | everything |
| `max` | **how far the wheel reaches** | the wheel |
| `absoluteMax` | the real ceiling, defaulting to `max` | values not from the wheel |

**The step bands are not a constraint at all.** They exist so a 500-hour wheel
can be navigated, and a value that did not come from the wheel is held to the
floor and the ceiling only — `clampToScale`, not `snapTo`. Typing `47h 20m`
saves 47h 20m; the wheel shows 47h / 15m, the nearest row it is able to draw.

The split between `max` and `absoluteMax` is the same argument one level up: a
wheel that stops at 500h is a statement about how far anyone will spin, not about
how long a duration can be. Typing `700h` keeps 700h and leaves the wheel resting
on its last row. A scale whose wheel can already reach everything the field may
hold — `TIME_OF_DAY`, where 23:59 really is the end — simply omits it.

Rounding it instead loses something the user actually meant, for a reason that
is purely about drawing. It was also inconsistent: a value stored off-grid by
anything else was already displayed as-is, so the same number survived when it
arrived from the backend and was destroyed when it was typed.

`snapTo` still exists and is still right — for **where the wheel points**. The
two answers are allowed to disagree, and that disagreement is the whole design:
`clampToScale` decides what is kept, `snapTo` decides what is drawn. Spinning a
wheel naturally replaces an off-grid value with an on-grid one, which is correct:
choosing from the wheel means choosing what the wheel offers.

### Opening never emits, and an off-grid value is shown as stored

A value the scale does not allow — 7 minutes against a grid of 5 and 10, from
older data or another client — is displayed **as stored** while the wheels open
on its nearest allowed neighbour. The control never rewrites a record the user
only opened to look at, and never shows a number that is not what is saved.
`onChange` fires only on a spin or a tap.

### Where the numbers live

`config/wheelFeel.ts` holds every knob — row height, visible rows, fling gain and
friction, tap slop, tickSound volume — and the component reads them. The row height
also reaches CSS as a custom property, because the offset arithmetic and the
rendered row must agree and nothing is measured.

The list is padded by `(rows - 1) / 2` items so that offset `0` puts the first
option on the centre line; the wheel's offset is then exactly
`index * itemHeight` with nothing to correct for. The centre pill is drawn by
`TimeInput`, outside the wheels, because the wheels carry a `mask-image` for the
edge falloff and a masked pill would fade with them.

---

## `Field`

The text input. One **shell** and — once formatting lands — two **bodies**:
`FieldShell` owns the label, the chrome and every dimension, `TextField` is a
`<textarea>`, and a Lexical body will slot in beside it. The shell is what makes
them look like one control; the split is what stops name and goal being dragged
into a `contenteditable`, which is where WebKit caret and IME bugs live and
which would forfeit native autocorrect, dictation, selection handles and Look
Up.

### There is no read mode

Apple Reminders, not Google Calendar. The field is always a live, focusable
input, so editing an event's name costs no clicks at all rather than the
open → preview → Edit → sheet that Calendar asks for. Everything below exists
to make a control that is permanently editable still read as a document.

### Focus changes paint, never layout

The rule the whole primitive rests on. Padding, `min-height` and border-*width*
are identical at rest and focused; only the border **colour** and the background
move. A heavier focus line would have to come from `box-shadow` or `outline`,
which are out of flow — growing the border by a pixel reflows every field below
it, and a form where focusing the first field nudges the other six is exactly
the jumpiness the merged read/edit mode was meant to avoid.

The fill is `--surface-subtle`, a lighter step than the `--surface-sunken` the
segmented control's track uses — at field size, across several stacked fields,
`#ececec` read as heavier than a focus ring needs to be.

This cannot be checked by eye, which is why `/lab` renders a probe paragraph
under every specimen. Measure the probe's `top` **relative to the field's own
top**, not to the viewport: focusing scrolls the element into view, and that
scroll otherwise reads as a 300 px layout shift. Verified across all seven
specimens, on the page and inside a modal: `Δheight` and `Δgap` are both
exactly `0`, while the border goes `rgba(60,60,67,.29)` → `--accent` and the
fill `transparent` → `--surface-sunken` at an unchanged `0.5px`.

### Nothing is limited, so nothing has to be enforced

No `maxLength`, no counter, no near-limit state, no `maxRows`, no internal
scrolling. A ten-line name is allowed and simply displays as ten lines, which
is what Google Calendar does and is the right answer: weird input earns a weird
outcome, and the app already survives long names because breadcrumbs clip by
design.

A limit on the **number of lines** was considered and rejected outright. Line
count is a property of *layout*, not of content — the same goal is three lines
on an iPad and five on an iPhone SE — so a three-line rule makes text that was
legal when typed illegal when reopened, with no way for the reader to tell why.
Character limits are the only kind that would be stable, and even those buy
nothing here: hard-blocking keystrokes is the failure users hate most, and it
truncates a paste silently.

### The box grows by replicating itself, and measures nothing

`.field-body` is a grid; a hidden `::after` carrying
`content: attr(data-replicated-value) " "` sizes the row, and the textarea is
stacked in the same cell and stretches to it. The field is already controlled,
so the sync is one attribute — no `scrollHeight` read, no layout thrash, and
nothing to race with Ionic's asynchronous first pass. Same spirit as
`SegmentedControl` placing its indicator arithmetically.

`field-sizing: content` would replace all of it in two lines of CSS. **WebKit
has not shipped it**, so it cannot be the mechanism for an iOS app; it is worth
revisiting the day Safari ships it.

Four things look removable and are not:

- **The trailing `" "` after `attr()`.** Without it a value ending in a newline
  loses its last row. Measured directly: the same four-line-plus-newline value
  is 104 px with the space and 82 px without — one whole line, silently.
- **`rows={1}` on the textarea.** Its intrinsic height is two rows, and in a
  shared grid cell that outvotes `minRows: 1` — every field would open at two
  lines.
- **Font, padding and line-height being shared by the replica and the
  textarea.** They are written as one rule for this reason: if they drift, the
  replica sizes the row for a different wrap than the reader sees.
- **`grid-template-columns: minmax(0, 1fr)` together with
  `overflow-wrap: anywhere`.** One word too long to fit a line otherwise widens
  the field instead of breaking, and the damage is not confined to the field:
  the column pushed past its container, the page gained horizontal scroll, and
  the whole layout slid left with the field sitting centred in it. Both halves
  are needed. An `auto` grid column is floored at its content's min-content
  width, so the column has to be told it may be narrower than its content; and
  `overflow-wrap: break-word` breaks the word for *layout* while still
  reporting it whole to min-content, so only `anywhere` shrinks the intrinsic
  width that sized the column in the first place. Verified at 900 px and
  375 px: the field stays exactly its container's width, the word breaks across
  lines, and neither the document nor `ion-content`'s scroller overflows.

### `minRows` is a floor, not a size

`context` opens at three rows to signal there is room to write, then grows.
Verified live: empty → 3, `"one"` → 3, four lines → 4, four lines plus a
trailing newline → 5, and 2 000 characters → 10 rows with no internal scroll at
any point.

### Enter, where a newline is not wanted

`allowNewlines: false` does not limit anything — it stops a *name* growing a
paragraph. Enter is swallowed, then `onEnter` runs if given, otherwise the field
blurs, which dismisses the keyboard on iOS. It deliberately does **not** trigger
the modal's Save: a stray Enter should never submit a half-filled form, and Save
is the modal's business. The `onEnter` hook exists for the inline "add task"
row, where Enter should create and keep focus.

`enterKeyHint="done"` is set only in that mode, so the key is labelled to
match, and **it works on a `<textarea>`** — the doubt was whether WebKit would
apply it to a control that is multi-line by nature. Confirmed on an iPhone 17
at iOS 26: the return key becomes a blue **checkmark**, which is the key Google
Calendar gets for an event name and the one that was asked for here. The
control case is the goal field beside it — no hint, grey `↵`. Pressing the
checkmark blurs and leaves the value untouched, with no newline inserted.

The glyph is still the OS's, not ours: a page names the *intent* and the
platform picks the key face. `done` happens to draw as a checkmark on both iOS
and Gboard, so there is nothing to special-case, but nothing here forces it
either.

### What a hairline is on a 3× screen

Also measured on that pass, because `--hairline-width` is `0.5px` and a 3×
screen has no half of a device pixel to give it:

| declared | computed | device pixels |
|---|---|---|
| `var(--hairline-width)` (`0.5px`) | `0.333px` | **1** |
| `1px` | `1px` | 3 |
| `0.5px` | `0.333px` | 1 |
| `calc(1px / 3)` | `0px` | **0 — the border is not drawn at all** |

So WebKit snaps a sub-pixel border to exactly one device pixel, and `0.5px` is
the spelling that gets there. **Do not try to compute `1 / dpr` yourself** — a
width that lands below the snapping threshold rounds to zero and the line
disappears silently, which is the same class of bug as the calendar's but in
the opposite direction.

The field's bottom edge measured at 1115.953 device pixels — a fractional
boundary, which `docs/calendar-layout.md` warns can antialias a hairline to
nothing. It does not here: the line renders at every field on the page. That
warning is about the calendar's *flexed, fractional column widths*, where the
edge moves with the layout; a stacked form has no such churn.


Enter is left alone while an IME is composing (`isComposing`), or confirming a
candidate would end the edit instead of the word.

### The hairline is the app's field chrome

Settled by comparing them on identical content in `/lab`: a bottom
`--hairline-width` line in `--separator` that fills with `--surface-sunken` on
focus, against a full `1px --border-control` box that gains an accent ring —
the idiom `TimeInput` still draws.

The hairline won because it scales in both directions and the box does not. A
hairlined 34 px time control reads fine; a `1px #999` box drawn around a
ten-line description reads like a web form from 1998, and a modal stacking six
of them is noisy where six hairlines are calm. It also speaks the line language
the app already has — `--separator` is what draws the modal header and footer
rules and the menu rows.

What it costs is that a hairlined control is marginally less obviously tappable
than a boxed one. The focus fill covers that, and says "you are in *this* one"
more clearly than an outline does.

Two of the differences are **not** chrome and do not resolve by picking one:
height (a duration is one token at a fixed 34 px; prose has to grow) and width
(`TimeInput` caps at 360 px because its wheels need a sane column). Those stay
different whatever the border does.

### The presets are not in `ui/`

A primitive must not know what a task goal is. `src/modals/fieldPresets.ts`
holds `NAME_FIELD` / `GOAL_FIELD` / `CONTEXT_FIELD` as partial props, spread at
the call site:

```tsx
<Field {...GOAL_FIELD} value={goal} onChange={setGoal} />
```

Turning formatting on for a field is then one key in that file and no change
anywhere else, which is the whole reason both bodies are reached through one
`Field` with one prop shape.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| `/lab` and `public/field-probe.html` are wired into the shipped app | Both are dev scaffolding, the same kind `909a01f` removed when the wheel was done — a route in `App.tsx` and a page Vite serves from `public/`. They leave with the work they support. |
| `TimeInput` has not moved onto the field chrome yet | It is still a full `1px --border-control` box with an accent ring on focus, which is the idiom the hairline replaced. Until it migrates a form holding both draws two different answers to "this is a field". `/lab` renders them side by side; the comparison row can go once it has. |
| A long placeholder can be clipped | The replica carries the value, not the placeholder, so an empty field is `minRows` tall however long its placeholder is. Every current preset fits on one line at 343 px (the phone width), but a longer one would be cut. Replicating the placeholder instead would make an empty field taller than `minRows`, which is worse. |
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
| The tickSound volume is a fixed level, not a system volume | `WHEEL_TICK.volume` is an absolute gain on a synthesized tone, so it does not follow the device's ringer level the way a real UI sound would — it started ten times too loud. If sound is kept, it likely wants to become an asset played through a proper audio session rather than an oscillator. |
| A tickSound can be missed on a fast fling | `minIntervalMs` rate-limits the click, so a throw crossing detents faster than every 28 ms ticks less often than it moves. Deliberate — the alternative is a buzz — but it means the ticks are not a count of rows passed. |
| Mobiscroll cannot supply the wheels | Asked and answered against the installed `@mobiscroll/react-trial@6.1.2`: `Scroller` is absent from the runtime bundle's exports and is not a v6 product but the internal base class behind `Datepicker`/`Select`, with `value`, `onChange` and `onWheelMove` all `@hidden` and no `wheels`/`data` prop — the arbitrary multi-column API was a v4 feature that v6 dropped. `Datepicker controls={['time']}` fits time mode but takes a single `stepMinute`, so it cannot express the bands, and has no duration control at all (`max` is a `Date`). Do not re-open this without checking the bundle again. |
| Scales are not validated at runtime | Bands must be ordered by `from` and reachable from it; nothing enforces either. A malformed scale produces a wheel with odd gaps rather than an error. The tests cover the shipped scales, so this only bites a new one. |
| No haptics on the detents | `@capacitor/haptics` is installed and a selection tickSound per detent is what makes a native wheel feel right on device. Left out to keep the primitive free of Capacitor. |
| A very wide scale means a long column | The hour wheel for a 500-hour scale is 181 real DOM nodes, which is fine; a scale allowing single minutes across that range would be 30 000 and would need virtualising. The band arithmetic never enumerates them, but the rendered column would. |
