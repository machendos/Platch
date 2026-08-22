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

This cannot be checked by eye, so it is checked with a probe element directly
under the field. Measure the probe's `top` **relative to the field's own top**,
not to the viewport: focusing scrolls the element into view, and that scroll
otherwise reads as a 300 px layout shift. Verified across all seven
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

Settled by rendering them against each other on identical content: a bottom
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

## `Checkbox` and `Reveal`

Two primitives, because the sketch that prompted them is two separate things: a
box that is ticked, and content that is there only while it is. An earlier draft
made them one — `trailing` and `children` slots on the checkbox — and that was
rejected before it was written. **A control must not own layout for arbitrary
content.**

### The link between them is a variable, not an id

```tsx
const [timed, setTimed] = useState(false);

<Checkbox checked={timed} onChange={setTimed} label="Time needed target" />
<Reveal when={timed} axis="inline"><TimeInput … /></Reveal>
```

Registering checkboxes by id and looking them up — `<ShowWhen checkbox="timed">`
— was considered and dropped. It re-implements what `useState` already is, a
typo'd key fails silently where a typo'd variable does not build, and it
introduces exactly the collision it would then have to solve: two modals holding
the same id.

That collision does not exist as written. State is per component instance, and
`@ionic/react` mounts an `IonModal`'s children only while it is presented —
`handleWillPresent` sets `isOpen: true`, `handleDidDismiss` sets it back — so a
closed `create` modal has nothing in the DOM when `edit` opens. Only
`keepContentsMounted` changes that, and `Modal.tsx` does not set it.

### The label wraps the box and its text, and nothing else

`Checkbox` is a `<label>` around a clipped `<input>`, a painted box and the
text. Wrapping means no `useId`/`htmlFor` pair, and the box *and* its text
toggle. It also means **anything inside that label toggles it**, which is why
the revealed control is a sibling and never a child: a `TimeInput` inside the
label would flip the checkbox on the tap that opens its wheels and flip it back
on the tap that picks a value.

The input is clipped rather than `display: none` because focus, the space key
and the checkbox role a screen reader reads are the input's, not the painted
box's. The box is the one `.time-input-field` and `.select-field` draw, at
checkbox size, so a row of mixed controls reads as one set.

### Height comes from a grid track, not a max-height

`Reveal` animates `grid-template-rows: 0fr → 1fr`. Its children are arbitrary —
a row, a paragraph, a whole `TimeInput` — so a max-height would be a guess, and
measuring one is the layout read `Field` avoids and that races Ionic's first
pass.

**`0fr` does not collapse across the inline axis**, and that was measured rather
than assumed: down the block axis the track resolves to `0px`, but on a grid
sized by its own content the fr track is what supplies that content size, so it
resolved to the full 68 px of the field it was meant to be hiding. `axis="inline"`
therefore does not animate size at all — the content arrives at its own width
and fades in from a few pixels out. Nothing is displaced by that: the row's
first child holds the left with a `margin-right: auto`, and there is nothing to
the right of it.

### Opening is a forced reflow, not a `requestAnimationFrame`

A transition needs a resolved state to leave, and the closed one has only just
been committed. Reading layout (`getBoundingClientRect`) resolves it.

`requestAnimationFrame` was the obvious way to wait a frame and is the wrong
one: **it does not run in a hidden page**, which is already recorded above for
the wheel. The content mounted, the class never landed, and the reveal stayed
collapsed for good — visible in the preview browser, where the pane is hidden
often enough for this to be the normal case rather than the exception. The
unmount at the end is a timer for the same family of reasons: `transitionend`
never arrives under reduced motion either.

### Clipping is for the travel only

`overflow: hidden` is what lets the track cut the content off, and it is
released by that same timer once the reveal is open. Left on, it would cut the
wheels off a `TimeInput` opened inside a reveal — the sketch's own case, since
`min block` sits in a nested row. Verified: the reveal grows from 44 px to
212 px, the 170 px panel sits inside it, `overflow` reads `visible`.

### The row they sit in is not a primitive yet

"One line, checkbox left, control at the right edge, 44 px tall, nested lines
indented" is five lines of CSS living in the lab page, not in `src/ui/`.
`.create-project-row` in the `Select` work is the same row hand-rolled a second
time; when a real modal wants it, those two are what justify lifting it.

---

## `Select`

A field that opens a list and takes one value out of it. Bound to the small
closed sets the schema is full of — `recurringByMonthDay` (1–31),
`recurringByMonth`, `RecurringFrequency`, project status, colour.

**It is for correcting a value, not for entering one.** These fields mostly
display something that arrived another way; the control exists so the user can
adjust it. That is why it is deliberately plain, and why it does not try to
compete with `TimeInput`'s machinery.

### The panel is an `IonPopover`, unlike `TimeInput`'s

The two solve the same problem — a field that opens a picker — and they solve it
differently, which is worth stating plainly so the next person does not assume
one is an oversight.

`TimeInput` expands **in flow** and scrolls itself into view on every frame of
the expansion. `Select` **portals** to `<ion-app>` and lets
`getPopoverPosition` place it: it clamps against all four edges, flips above the
trigger when there is no room below, respects the safe areas, and falls back to a
scrollable panel anchored to the trigger when neither side fits. Nothing here
measures anything.

The trade is real in both directions. The popover cannot be clipped by whatever
contains the field and needs no reveal logic; but it does not follow the trigger
when the page moves, which is why scrolling dismisses it (below).

### Ionic takes the focus away in three places, and each needs its own answer

This is the part that took the longest to get right, and it is worth stating in
full because two visible bugs came out of getting only part of it. All three
live in `@ionic/core`'s `utils/overlays.js`, and **none of them implies the
others**:

| What | Fix |
|---|---|
| `trapKeyboardFocus` pulls focus back inside the overlay | `focusTrap={false}` |
| `overlay.el.focus()` runs *after* `didPresent`, so it overwrites any refocus done there | `keyboardClose={false}` |
| `restoreElementFocus` is called by `present` for every overlay that is not a toast, and **blurs the field on the way in** | refocus the field in `onDidPresent` |

The third has no prop and no opt-out — `present` calls it unconditionally
(`overlays.js:449`). It captures `document.activeElement`, blurs it immediately,
then after dismiss puts focus back if nothing else has taken it.

Both halves of that produced a real bug:

- **Blurring on the way in** meant the caret was gone the instant the panel
  opened. The field could not be typed into until it was clicked a *second*
  time, so it behaved as a dropdown-only control on a desktop.
- **Restoring on the way out** meant clicking a *second* `Select` handed the
  caret back to the first one. That field's own present had just blurred it, so
  focus was momentarily on `<body>` — which is exactly the condition
  `restoreElementFocus` waits for. The result was the second field's panel on
  screen while the first field still took the typing.

The second bug was caused by the first.

**The restore is disarmed rather than raced.** The field blurs itself just
before Ionic presents — `onClickCapture`, which runs ahead of the click listener
Ionic put on the trigger — and takes focus back in `onDidPresent`. Ionic
therefore snapshots `body`, which makes both halves of the restore no-ops: it
blurs body going in and focuses body coming out.

Trying to *beat* the restore instead does not work, and the reason is worth
keeping. The obvious fix is to blur the field again after `didDismiss`, on the
next frame. But the restore's own condition is `activeElement === body` — so
that blur does not defeat the restore, **it creates exactly the state the
restore is waiting for**. Measured: with the blur-after approach the field was
focused again by the time the panel finished closing, which is the "stays
selected for a moment" the second bug reported. Removing focus early and never
giving Ionic the field to remember is the only version that holds.

Nothing here wants `keyboardClose`'s documented effect either — on touch the
field is a button, so there is no keyboard to dismiss.

### Open and closed are read from the `will` events, not the `did` ones

The field's border comes from `isOpen`, and taking that from `onDidDismiss`
meant it only changed once the leave animation had finished — so the control
went on looking selected for a beat after the click that closed it. Only when
it was open at the time, though: closing it by picking a row had already
flipped the state, so that same click felt instant, and the control behaved
differently depending on what you had done last. Both edges now come from
`onWillPresent` / `onWillDismiss`, which fire when the transition *starts*.
Measured: the open class now drops 3 ms after `willDismiss`.

### Scrolling the active row into view must not scroll anything else

`scrollIntoView({ block: 'nearest' })` is the obvious call and it is the wrong
one here: it is free to scroll any ancestor, and an ancestor scrolling fires a
scroll event that the dismiss listener below reads as the page moving — so the
panel dismissed itself. It runs on every change of `active`, which is every
keystroke and every arrow press, so the panel could begin fading out from under
the very typing that moved the highlight. Adjusting the list's own `scrollTop`
from the two rects cannot touch anything outside the list.

### Anything outside it dismisses, and scrolling counts

It also **gives up the caret**, not just the panel. Closing without blurring is
what left a field still taking keystrokes while a different field's panel was the
one on screen, so the two have to happen together.

Capture-phase `pointerdown`, `wheel` **and** `scroll`, tested by node identity
rather than by selector so a second `Select` on the page cannot suppress this
one. The same listener `HeaderMenu` needs, for the same reason — and it is
duplicated between them rather than shared, which is worth fixing the next time
either is touched.

`scroll` is in the list because **`wheel` does not fire for touch scrolling**, so
without it the panel would sit stranded after a flick on a phone. `HeaderMenu`
listens only for `wheel` and so probably has that gap.

The backdrop is transparent *and* inert — `pointer-events: none` on the host and
the backdrop, `auto` on the content, as `HeaderMenu` does. Here it is not only
about keeping the page live: on a desktop the field is a text box the user may
still be typing into, and a backdrop over it would eat the click.

### On a desktop the field is a text box, exactly as `TimeInput`'s is

`isCoarsePointer()` decides, and the answer is cached. Touch gets a `<button>`,
so no software keyboard ever covers the panel; a fine pointer gets an `<input>`.

**The typed text drives the highlight, and the highlight is what commits.**
Typing resolves through `resolveTyped` to an option index, which moves the active
row; Enter or blur commits that row. So there is one path — the list is always
the thing being chosen from — and no separate parse-and-clamp step. Text that
resolves to nothing is discarded rather than guessed at, and the field falls back
to the value it held, which is `TimeInput`'s rule too.

Resolution is **exact before prefix**. With 1–31 in the list, `3` is both an
option and the start of `30` and `31`, and the one actually typed has to win.

There is deliberately **no type-ahead buffer**. An earlier design had one, with
a repeated character cycling through matches the way a native `<select>` does;
`2`,`2` selecting 2 and then 22 is surprising when the field is a text box that
can simply hold `22`.

### Options carry their own text

A `ReactNode` cannot be read as text without rendering it — the same wall
`Breadcrumbs` hit when it needed label widths and had to build a mirror. So
`optionText` resolves `text ?? (string label) ?? String(value)`, which means
numbers and plain names need no extra field and only an icon-bearing option sets
one.

A consequence: the **button** renders `label`, so it can show an icon, while the
**input** can only ever show `optionText`. An option whose meaning lives in its
icon will read as its text on a desktop.

### The value is `string | number`, and that is a boundary

It is the React key, the equality test and the fallback text. Widening it to
arbitrary objects breaks all three. Labels are already `ReactNode`, which is
where icons go.

### The panel is exactly as wide as the field, via `size="cover"`

Ionic measures the trigger and writes `--width` from it
(`animations/ios.enter.js`), so the two edges line up without this component
measuring anything — the same arithmetic-not-measurement preference
`SegmentedControl` follows.

Sizing the panel to its own content instead is the obvious first move and it
looks wrong: a list of `1`–`31` under a 189 px field is about half its width and
hangs off the left edge, reading as a detached box rather than as the field
opening. A `--min-width` floor does not fix it either, because the field's width
comes from the layout it sits in and is not knowable here.

Nothing may set `--width`, `--min-width` or `--max-width` on the host — they
fight the value Ionic writes. Measured: field 189 px, panel 189 px, both edges
flush to 0 px.

### Tokens are on `:root`, and the row height changes with the pointer

The panel is portalled outside the page shell, so anything it reads has to be on
`:root` — the same placement, for the same reason, as `Modal.css` and
`HeaderMenu.css`. `--select-row-height` is `--touch-target` by default and drops
to `--control-height` under `@media (hover: hover) and (pointer: fine)`;
Ionic's own `.popover-desktop` is not used because it is evaluated once at render
and misses a mouse plugged in later.

`--max-height` is `6.5` rows so a long list is cut mid-row — the half row is what
says it continues.

**The fill belongs on `::part(content)`, not on the list inside it.** With the
surface on the list, Ionic's own part stayed transparent, so anything that put
the panel part-way through its fade showed the page straight through it — rows
with the dispatcher's items legible behind them. One opaque box, clipped to its
own radius, has nothing to see through. `overflow: hidden` is safe here for the
same reason there is no custom animation: `HeaderMenu` needs `visible` only so
its scale transform can escape.

### The chrome comes from `FieldShell`, not from here

`Select` renders its trigger as a child of `FieldShell`, the same shell `Field`
and `TextField` go through, so the hairline, its focus colour and the fill are
defined once. `Select.css` sets no border, radius or fill of its own — only
layout, and `position: relative` on `.field-control` for the chevron to hang
from.

It started out drawing a full `1px --border-control` box, copied from
`.time-input-field` so a day field and a time field on one row would match.
That was the right instinct against the wrong reference: **the hairline had
already won that comparison** — see *The hairline is the app's field chrome* —
and `TimeInput` is the control that has not migrated yet, not the one to match.
Restating the hairline locally instead of using the shell would have been the
fourth copy of a decision `--hairline-width` had just finished consolidating.

Two things are worth keeping from the switch:

- **The dropdown is the easiest field to hairline, not the hardest.** The one
  cost the shell's own notes name is that a hairlined control is less obviously
  tappable than a boxed one. `Select` is the single field that answers this for
  free: the chevron is the affordance, so nothing is given up.
- **The panel relates better to a hairline than to a box.** A boxed field under
  a boxed panel is two outlines meeting; a hairline under a floating card reads
  as one object opening — helped by `size="cover"`, which already makes the two
  exactly one width.

**Open is a class, not `:focus-within`.** The shell fills on focus, but the
field deliberately gives up focus for an instant on the way into `present` (see
above), and a focus-driven fill blinks across that gap. `.select-is-open` is
driven from the same `isOpen` the `will` events set, so the fill turns on when
the panel starts opening and off when it starts closing.

The one seam: flipped **above** the field, the panel meets the top corners,
which the shell rounds because its radius is shaped for a fill sitting on a
bottom border. Opening downward has no such join. Minor, and only in the
flipped case.

---

## `DateInput`

A field that opens a calendar and takes one date out of it, for
`absoluteFrom` / `absoluteTo` and, later, `earliestDate` / `deadlineDate`. It
wraps mobiscroll's `Datepicker` in `FieldShell` chrome, so it draws the same
hairline as `Field` and `Select` rather than a fourth answer to "this is a
field".

Like `Select`, its `label` is for assistive technology only and nothing is
drawn for it — these sit on rows that carry their own word (`From`, `To`).

### The trigger is a button, and the text in it is ours

A custom `inputComponent` is handed only `{defaultValue, placeholder, ref}`.
`defaultValue` is the giveaway: the value is **uncontrolled**, written into the
element through that `ref` as the picker changes. So an `<input>` there would
display whatever mobiscroll formatted, and `serializeDate` would never be what
the field says.

Passing our own serialized text through `inputProps` and rendering it into a
`<button>` is what keeps one date format in the app. `Header`'s range picker
already worked this way; this is the same move with the field chrome on it.

The cost is that **there is no typing on a desktop**, unlike `Select` and
`TimeInput`, whose fields become text boxes under a fine pointer. Recovering it
means letting mobiscroll own the text, which is the thing being avoided.

### Open is a class, not `:focus-within`

The calendar takes the focus while it is up, so a fill driven by the shell's
`:focus-within` drops off the field the moment its own panel appears. `onOpen`
and `onClose` carry it instead. Same problem `Select` has, same fix — and
unlike `Select`, mobiscroll owns the dismissal, so there is no capture-phase
outside-interaction listener here at all.

### Picking is two taps, not one

Under a coarse pointer `touchUi` gives the anchored calendar **Cancel / Set**
buttons, so a day is chosen and then committed. That is mobiscroll's touch
default and it is left alone: it is the behaviour with an explicit way out.
A single-tap commit is `buttons={[]}` away if the form ever wants it.

### `WEEK_STARTS_ON` moved for this

It was in the main page's `layout-config.ts`. A control in `src/ui` reaching
into `src/pages` for a preference is the wrong direction, and the value was
never the main page's to own — it now sits in `config/calendarPreferences.ts`
beside the other knobs primitives read. Verified: the calendar's header renders
`MON TUE WED THU FRI SAT SUN`.

---

## `ToggleGroup`

`SegmentedControl`'s sibling, for the fields that hold a **set** rather than one
value — `recurringByDay` above all.

### It is not a `multiple` mode on `SegmentedControl`

The two cannot draw the same way. That control's selection is a single box
placed arithmetically from the option count and the selected index, and slid
between positions — **one box cannot be in three places.** Here the fill belongs
to each option instead, which is also what says the choices are independent
rather than exclusive.

### Round and gapped, with no track — and that is the point

The first version shared `SegmentedControl`'s track exactly, reasoning that a
row of weekdays sitting directly under a row of frequencies should match. That
was the wrong thing to hold constant. **Matching made the two
indistinguishable**, so nothing about the weekday row said that more than one
answer was allowed — a user had to press one and watch what happened to the
last.

So the shape now carries the difference. A segmented control fills one
continuous groove because exactly one of its options is ever on; this is a row
of separate shapes with space between them, which is what a row of independent
switches looks like. The two are told apart before either is touched.

Unselected is a hairline ring on `--surface`, selected is an `--accent` fill.
The ring keeps its width and changes only colour, so selecting cannot move
anything — the rule `FieldShell`'s focus state follows, for the same reason.

The shape itself is `--toggle-option-radius`, a token alongside
`--toggle-option-size`, which is what let six candidates be compared in the lab
as the same component with two values changed rather than six forks. Settled on
a **36px squircle at radius 12** — circles read as the most obviously
multi-select but were the hardest to hit, and a plain rounded square read as a
key on a keyboard.

### The options are a fixed size, not flexed

Equal-width segments made sense inside a track that had to be filled edge to
edge. A separate shape has no such duty, and it has one it cannot escape: it
has to keep its proportions. Under `flex: 1 1 0` the days grew with their
container — 220px wide on a desktop, which is neither a squircle nor a weekday.

Fixed, they draw the same at 375px and at 1280px, and the row simply ends where
it ends instead of tracking a container it has nothing to do with. That removes
the whole class of "does it still fit" question at large widths; **only the
small end can bind.**

### What is drawn and what can be hit are different sizes

Only the first is a design decision. A 30px shape in a 44px row claims 30px of
it and leaves the 4px gaps dead, so a thumb aimed between two days hits neither
and the control reads as ignoring the tap — which is exactly how it was
reported.

`.toggle-option::after` takes the full `--touch-target` height and half of each
neighbouring gap, so adjacent targets meet exactly: no dead strip, and no
overlap either, which would quietly hand a day's edge to its neighbour. 30×30
became 33×44 with nothing moving on screen. **Growing the shapes solves the same
problem by making the control bigger than it wants to be**, so reach for this
first.

The group carries a cancelling `padding` / negative `margin` pair of half a gap
so its box contains those targets. Without it the two end options overhang by
2px, which the group cannot see and an ancestor that scrolls would find. It
belongs on the group and not on the options row, or the two lines stop agreeing
where their left edge is.

### The select-all is on its own line, and that is arithmetic

At 36px the seven days need 276px of the ~318px a phone's recurrence row has.
That leaves 42px — less than the pill's own `min-width` before any gap at all.
It is not a near miss to be tuned away.

This is the trade the whole layout turns on, so it is worth stating plainly:
**with the select-all beside them the days cannot exceed ~32px; with it above,
they can be 44px.** Measured, not estimated — 36px inline overflowed by 19px at
375px. An earlier pass put a hairline rule between an inline select-all and the
first day, which read well and is gone with the layout it separated.

### The set comes back in option order

`onChange` emits in `options` order, never in the order things were pressed, so
a caller always receives the same set written the same way and never has to sort
it back. `serializeRecurrence` sorts as well, which is not redundant — that one
is defending against data arriving from the backend.

### `selectAllLabel` is generic, not a weekday shortcut

It turns every option on, and off again once they all are, and it is absent
unless asked for. That is a multi-select affordance rather than anything about
days — which is what keeps the domain out of the primitive, even though
`recurringByDay` is the only caller today.

It is drawn as a **pill**, whatever `--toggle-option-radius` the options are
wearing, so it stays distinct from them under every value of that token. On its
own line it is free to take the width its word needs rather than the width left
over.

It stays inside the primitive rather than becoming the caller's job, and the
reason is that there is nothing for a caller to own: its pressed state is a pure
function of `values`, its action a pure function of `options`. Split out, it is
not an independent control whose state happens to be coupled — it is the same
derivation rewritten at every call site, plus alignment that would have to
become local CSS.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| An inline `TimeInput` grows its row when opened | The wheels are an in-flow panel, so a `TimeInput` sitting at the right of a row expands that row to ~212 px and takes the width its columns need. Correct for a full-width field, surprising at the end of a line. The fix, if it is wanted, belongs to `TimeInput` (an overlay panel) and not to `Reveal`. |
| `Reveal` is unmounted by a timer, not by the transition | The exit is `REVEAL_MOTION.durationMs` on a `setTimeout`, so a transition slowed by anything else — a busy main thread, a devtools override — is cut off at that mark. `transitionend` cannot be used: it never fires under reduced motion or in a hidden page. |
| A block reveal animates its own growth twice over | If content inside an open reveal changes size — a `TimeInput` opening its wheels — the `1fr` track follows it, and that follow is itself transitioned. Two easings over one movement. Harmless today; it would show if the durations ever diverged. |
| `DateInput` cannot be typed into on a desktop | `Select` and `TimeInput` both become text boxes under a fine pointer; this one stays a button, because a custom `inputComponent` only ever receives an uncontrolled `defaultValue` and letting mobiscroll own the text would take the app's date format with it. A form holding all three offers typing in two of them. |
| A date is picked in two taps | Under a coarse pointer mobiscroll's `touchUi` puts Cancel / Set on the anchored calendar, so choosing a day does not commit it. Left at the default — it is the behaviour with an explicit way out — but `buttons={[]}` is the one-prop change if a form wants a single tap. |
| Two pickers anchor two different ways | `DateInput` lets mobiscroll position and dismiss its own popover; `Select` drives an `IonPopover` and carries its own capture-phase dismissal. Both are right where they are, but that is now three panel mechanisms in one form counting `TimeInput`'s in-flow one. |
| `ToggleGroup` has no keyboard arrow navigation | Same gap as `SegmentedControl` and for the same reason — a group of buttons, each tabbable, with no roving focus. Worth answering for both at once rather than twice. |
| `TimeInput` has not moved onto the field chrome yet | It is still a full `1px --border-control` box with an accent ring on focus, which is the idiom the hairline replaced. Until it migrates a form holding both draws two different answers to "this is a field" — and the recurrence row is exactly such a form: `on [30 ⌄]` is now hairlined and `At [5:45 PM]` beside it is not. `Field` and `Select` both go through `FieldShell`, so `TimeInput` is the last field still drawing its own box. (`Checkbox` is not a counterexample — it is not a field box at all, and carries its own out-of-flow focus outline.) |
| A long placeholder can be clipped | The replica carries the value, not the placeholder, so an empty field is `minRows` tall however long its placeholder is. Every current preset fits on one line at 343 px (the phone width), but a longer one would be cut. Replicating the placeholder instead would make an empty field taller than `minRows`, which is worse. |
| No keyboard arrow navigation | The segmented control is a group of buttons; each is tabbable but arrow keys do not move between them as a native radio group would. Fine for now, worth revisiting when forms get long. |
| Breadcrumbs are single-line only | The line budget is one row. Wrapping to two would not remove the need for the algorithm — `flex-wrap` has no notion of which node matters — it would just run the same plan against a doubled budget. Left out because a header whose height depends on ancestry depth moves everything beneath it on every navigation. |
| One long name ends the row early | The first node that will not fit is clipped and nothing further is added, because skipping it would split the run and produce a third `…`. So a single very long ancestor hides every shorter name beyond it. Deliberate, but the most likely thing to want revisiting. |
| A clip can be a single pixel | The clipped node takes exactly what is left, which is sometimes 1–2 px less than its natural width — a barely-visible cut to the last glyph. Harmless, but it means "is this label clipped" is not a question the eye can always answer. |
| Selected-segment colour is from the concept, not the app | The concept fills the selected segment with `--accent` and white text. The app's other "selected" idiom (`.header-button.active`) is an `--accent-surface` fill with dark text. They disagree; pick one when the design settles. |
| `--segmented-index` clamps at 0 | When `value` matches nothing the index is floored to 0 so the transform stays valid. The indicator is hidden in that case, so it is invisible — but if the indicator is ever made unconditional, this becomes a wrong-looking selection. |
| Typing and the wheels can disagree mid-edit | While the caret is in the field the typed text wins, so the wheels can show one value and the box another until Enter or blur. Committing reconciles them. Acceptable, but it is the first thing to revisit if the desktop field grows. |
| The desktop field has no explicit open control | Focus opens the wheels and Escape closes them; there is no chevron. Fine while the panel is inline, worth adding if it ever becomes an overlay. |
| The panel is positioned once, against wherever the field was | Ionic measures the trigger at present time and never again. Opening while the layout is still moving — a sheet modal animating up, a section expanding — anchors the panel to a position the field has since left. Verified: opened mid-animation on a phone the panel ran 149 px past the bottom of the screen; opened once settled it flips cleanly to `bottom: 560` against a field at `top: 559`. A user tapping a settled field never sees it, and scrolling dismisses — but **dragging the sheet does not scroll**, so that case can still strand it. |
| Two pickers, two mechanisms | `TimeInput` expands in flow, `Select` portals into a popover. Both are justified where they are, but a form holding one of each has two dismissal rules and two ways of getting out of the viewport's way. Reconcile if a third picker appears. |
| The dismiss listener is duplicated | `Select` and `HeaderMenu` each carry their own copy of the capture-phase outside-interaction effect. `Select`'s also listens for `scroll`, which `HeaderMenu` needs and lacks. Extract into one hook next time either is touched. |
| `Select` opens on click, not focus | The popover is driven by Ionic's `trigger`, whose action is a click. Tabbing to the field and pressing Down opens it, but tabbing alone does not — unlike `TimeInput`, where focus opens the wheels. |
| A label wider than the field is clipped | `size="cover"` caps the panel at the field's width, so an option whose text is longer than the field ellipsises rather than widening the panel. Fine for the numeric and weekday sets in use; if a set of long names turns up, that call site should widen its field rather than the panel breaking alignment. |
| An icon option reads as text on a desktop | The button renders the `ReactNode` label, the input can only render `optionText`. Fine for the numeric and named sets in use now; revisit when an option's meaning is carried by its icon. |
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
