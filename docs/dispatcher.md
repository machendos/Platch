# Dispatcher

The project list: three collapsible sections over one tree.

Code: `mobile/src/pages/main-page/dispatcher/`

---

## Swipe a row to move it between categories

Swipe a BACKLOG row sideways — either direction — and let go past about four
tenths of its width, and it moves to ACTIVE. Below that it springs back. There is
nothing to tap: releasing past the threshold *is* the commit, and the label
appearing is the only warning that it will happen.

Code: `projects/project-card/useProjectSwipe.ts`, `swipeAxisManager.ts`,
`projectSwipe.ts`.

### Three gestures, one element

`.project-row` is the activator for all three, and there is no drag handle to
separate them — dnd-kit's `PointerSensor` binds `pointerdown` to the row itself.
Telling them apart is the whole job:

| Finger does | Within 250 ms | Result |
|---|---|---|
| stays inside 8 px | — | dnd-kit's `Delay` fires → **drag** |
| travels > 8 px, mostly vertical | yes | nobody claims it → **scroll** |
| travels > 8 px, mostly sideways | yes | we claim it → **swipe** |
| anything | after 250 ms | the drag already started → **ignored** |

Two things make this cheap rather than delicate, and both are worth knowing
before changing any of it:

- **dnd-kit gets out of the way by itself.** Its touch constraint is
  `Delay({ value: 250, tolerance: 8 })`, and `DelayConstraint` aborts activation
  the moment the finger exceeds the tolerance. A swipe past 8 px therefore
  cancels the pending long press with no coordination at all.
- **The sideways axis is already ours.** `touch-action: pan-y` on the row means
  the browser never pans horizontally there, so `preventDefault()` on `touchmove`
  stays available.

The one case needing an explicit guard is the reverse — finger holds still, the
drag activates at 250 ms, *then* moves sideways. The gesture handles it locally:
**if the axis is still undecided once `DRAG_TOUCH_DELAY_MS` has elapsed, the
touch is abandoned.** No React state is wired into the native handler to ask
whether a drag is running.

### The lock distance is not a number of its own

`PROJECT_SWIPE_LOCK_DISTANCE` is defined as `DRAG_TOUCH_TOLERANCE_PX`, and both
live in `dispatcher/layoutConfig.ts` next to the sensor's delay. That is
deliberate.

Below the tolerance the long press is still pending, so claiming the touch any
earlier means a finger that starts a swipe and then stops still trips the drag —
the row is carried and swiped at once. Equal is the earliest that is safe.
Written as two separate `8`s they would eventually drift, and the failure is
silent.

`PROJECT_SWIPE_LOCK_RATIO` is 1.2, matching the calendar's: sideways has to beat
vertical by 20% to win. **Scrolling is the common intent, and wrongly stealing it
is worse than missing a swipe.** An even 45° drag is a scroll.

### `preventDefault()` alone does not hold iOS

The same trap the calendar documents at
[`calendar-layout.md`](calendar-layout.md) — *"Swipe: the axis is decided once
and kept"*. iOS may commit to a scroll before the gesture can be classified, and
after that `touchmove` arrives non-cancelable and the compositor keeps scrolling
on its own thread. So a locked swipe does both: `preventDefault()` for the case
iOS has not committed, and `setScrollLocked` on `.section-body` for the case it
has. Neither alone was enough there and there is no reason to expect otherwise
here.

`setScrollLocked` now lives in `system/helpers/scrollLock.ts` rather than in the
calendar, because it is one subtle workaround and two copies would mean only one
of them ever gets fixed.

Touch events rather than pointer events, for the same reason the calendar uses
them: Safari does not reliably honour `preventDefault()` on `pointermove`.
**A consequence worth stating: there is no mouse swipe.** A horizontal mouse drag
activates dnd-kit's 4 px distance constraint and becomes a drag. Desktop uses the
⋮ menu, which offers the same action.

### The listener is on the list, not on the row

`useProjectSwipe` binds to `.project-list` and resolves the row with
`event.target.closest('.project-row')` on `touchstart` — an ancestor walk, since
`event.target` is whichever leaf is under the finger and never the row.

**This is correctness, not economy.** Rows unmount constantly — an ancestor
collapsing, the reveal animation, a snapshot arriving mid-gesture — and React
tears a per-row listener down with them, mid-touch, so the gesture stops
receiving anything at all. A listener on the list outlives any row it resolves.

It does not make the ending bulletproof, and it is worth being precise about
why: a `touchend` aimed at a node React has already detached propagates
nowhere, whichever ancestor the listener sits on. See *Nothing may be left
behind* below for what actually guarantees the release.

### The action surface is the whole line

The row does not open a drawer beside itself; it **slides across a surface that
covers the whole line**, the way Gmail does. That choice is what makes the rest
simple — the row is opaque, so what shows is exactly what it has uncovered, and
nothing has to measure the uncovered strip or resize to match it.

Three things follow from "the whole line", and they are the reason the first
attempt (a drawer inside the row, sized to `abs(dx)`) had to go:

- **It cannot live inside the row.** A row is indented by its depth and clips
  itself to its own radius, so a child could never reach further left than the
  card does — a depth-3 row's surface started three indents in.
- **It reaches past the list's own inset.** `.section-body` insets its list by
  `--section-body-padding`; the surface cancels exactly that with a negative
  `inset-inline`, so it meets the section's border. The row can travel that far,
  so the surface under it has to.
- **What leaves the section is clipped by the section**, not by the row.
  `.section-body` gets `overflow-x: hidden` for that — and it needs it anyway:
  beside `overflow-y: auto`, `visible` computes to `auto` and the section would
  grow a horizontal scrollbar the first time a row moved.

So there is **one surface per list**, not one per row — only one row can be
swiped at a time — positioned over whichever row is being swiped through
`--project-swipe-top` / `--project-swipe-height`. It is absolutely positioned in
`.project-list`, which is already `position: relative` for the consequence line,
and rendered *before* the rows so it paints underneath them. `.project-row` is
`position: relative` for that reason alone: positioned siblings paint in tree
order, and a static row would sit below every one of them.

State is split to match what it describes. The list carries the gesture —
`data-swipe-side`, `data-swipe-armed`, where the surface sits. The row carries
only `--project-swipe-dx` and `data-swipe-active`. Both are written straight onto
the elements per frame; no React render is involved.

Two details are load-bearing:

- **The transform is gated on `data-swipe-active`.** A standing `translateX(0)`
  would hand every row a compositing layer, and would be a transform for dnd-kit
  to fight over on the row it is carrying.
- **The transition is switched on only while settling.** Same reason the row's
  own transition names `margin-block-start` and nothing else.

### Letting go is two different motions

Returning and leaving were one duration and one curve to begin with, and that was
wrong in both directions.

**Returning** is now the longer of the two (`PROJECT_SWIPE_RETURN_MS`) and runs
on `--easing-gentle` rather than `--easing-standard`. The standard curve spends
most of its distance in the first third — decisive when something is arriving
somewhere, a snap when something is only going back where it was, which is all a
cancelled swipe is.

**The surface holds full brightness for the first half of the return and is gone
by 85% of it**, on its own keyframes. Both simpler options were shipped and both
were wrong: switching it off when the row's transition formally ended left it
glowing for ~60ms beside a row that had plainly stopped, because an ease-out
spends its last pixels slowly; and fading it across the whole return made it
vanish the instant the finger lifted. The indent gutter is what makes either
obvious — it is the one strip a returning row never covers again, and on a nested
row it is wide.

**Leaving** is `PROJECT_SWIPE_EXIT_MS` *scaled by how much of the row is still on
screen*, and then hands over:

1. the row finishes travelling off the line;
2. **the row and every rendered descendant** start closing the space they held,
   while the surface — still one line, not stretched over the subtree — closes
   with them;
3. that space closes over `--project-reveal-duration` using `project-row-depart`,
   which is `project-row-reveal` played backwards — height, margin *and opacity*
   — so the rows below rise exactly as they would sink for an arrival;
4. only then is the move sent.

**Step 1 is usually free, and must be.** The drag clamps at roughly the list's
own width, so on a narrow pane a committing swipe has already carried the row off
screen before the finger lifts. A fixed exit there is a pause spent sliding an
invisible row further out of sight while the surface sits frozen at full height
and the space stays open — which is exactly what "I lift my finger and wait about
a second" turned out to be. Nothing showing means `exitMs` is 0 and the space
starts closing immediately, without even a backstop to wait out.

It still travels *past* the clamp, because transitioning a value to itself starts
no transition at all — and with no transition there is no `transitionend`, so the
backstop becomes the pause instead.

Three more things were learned the hard way.

**The whole subtree departs, not just the swiped row.** A moved project carries
its children, so collapsing only the row under the finger left them standing in
the gap it had left, then blinking out when the move landed and dropping
everything below them a full tree's height with no animation at all.
`ProjectList` supplies the run, the same set the arrival animates and in the same
drawn order.

**The move is sent last, not first.** The optimistic update unmounts the row, so
sending it earlier leaves nothing to animate and the rows below jump — which is
exactly what they used to do.

**And the row is not tidied up afterwards.** It keeps its collapsed,
travelled-off styling until React actually removes it. Restoring it right after
sending the move — on the reasoning that React flushes before the next paint —
put one painted frame of the whole subtree back at full height in its old place
before it vanished. Frame-by-frame, the restore painted a frame *ahead* of
React's commit. The only thing that undoes the styling now is finding the row
still present a few hundred ms later, which means the move was rejected.

### Assertions cannot see a jump

Three separate one-frame glitches shipped through a verification pass built on
synthetic touch events, DOM state assertions and screenshots of artificially
slowed animations. Every one of them was invisible to that method, because each
was a single frame in the middle of a motion whose start and end were both
correct:

- the row popped by the activation distance on the frame the gesture was claimed
  (the offset is now measured from the lock point, not the touch point);
- the departing subtree sprang back to full height for one frame at handover;
- every arriving row painted once at full size before collapsing to unfold,
  because the reveal class was applied in `useEffect`, which runs after paint —
  `useLayoutEffect` puts it on before.

The last one predates the swipe and affects the menu-driven move and the drop
animation too.

What found them was sampling geometry every frame through a real gesture — the
`settleTrace` technique in [`debugging.md`](debugging.md), which exists for
exactly this. **It needs a visible tab**: a backgrounded one does not run
`requestAnimationFrame` and does not advance CSS animations, so the samples are
flat and the timers that back them are throttled to roughly a second. Checking
that a motion ends correctly says nothing about how it got there.

**And per-frame numbers are still not the same as looking.** The delay above was
reported fixed three times on the strength of a trace reading
`210/48@7 … 400/48@166` — smooth, continuous, starting 7ms after release. Every
one of those samples was an off-screen row moving between two invisible
positions. A screen recording showed it in two frames: 2.00s and 2.20s pixel
identical, a blue bar frozen at full height. **For anything about how a thing
looks, ask for a recording before instrumenting.** Sampling proves what the DOM
did, not what anyone saw.

### Neither ending may be trusted to a timer

Every phase ends on `transitionend` or `animationend`, with a timer only as a
backstop for when the event cannot arrive at all (reduced motion, or a transition
the browser treats as a no-op).

**And the transition has to be armed before the value changes.** Adding the class
that carries `transition: transform` and setting the new transform in the same
task gives WebKit nothing to animate from: it skips the transition, the row jumps,
`transitionend` never fires and the phase runs on its backstop. Chromium starts it
anyway, so this only ever appeared on a device. `transitionTo` sets the duration,
adds the class, forces a reflow, *then* moves. `pageOffset.ts` carries the same
forced reflow for the calendar, for the same reason.

This is the opposite of how it started, and the reason is measurable: a
`setTimeout` scheduled for 340 ms fires at **around 1000 ms** when the tab is not
in front. Everything downstream of it is visible — that delay *was* the action
surface staying lit long after the row had gone. Events fire with the motion the
eye is actually following, so they cannot drift from it.

### Nothing may be left behind

A swipe writes to two elements and clears them on a timer, which gives it two
ways to strand something visible. Both were real:

- **A second swipe starting inside the first one's settle.** The handle to the
  settling row is kept separately from the row under the finger, because the
  latter is dropped the moment the finger lifts — so without it the new gesture
  overwrote the timer and the first row kept its offset for good. Every
  `touchstart` clears whatever is still easing back.
- **Clearing a frame later.** The commit path used `requestAnimationFrame` to
  clear after the optimistic update, which **never runs while the page is
  hidden** — the surface stayed lit and the list stayed marked armed for as long
  as the tab was in the background. It now clears synchronously right after the
  move: React flushes before the next paint, so nothing is drawn in between.
  `pageOffset.ts` carries the same warning for the calendar.

The scroll lock is the one that matters most — leave `overflow: hidden` on the
section and it silently stops scrolling. Ending the gesture on the document
rather than on the list covers a finger that lifts elsewhere, but **nothing
placed anywhere covers the row being detached mid-gesture**: once React removes
it, neither its moves nor its end reach anything. So `touchstart` releases the
lock unconditionally before doing anything else. At worst the section is
unscrollable until the next touch — which is exactly what someone does when
scrolling seems stuck.

### The gesture does not know what it commits

`useProjectSwipe` takes a label, an icon and `onCommit(id)`, and nothing else
about meaning. `null` disables it. Which rows get an action, and what taking it
up does, is decided entirely by the caller:

```ts
useProjectSwipe(listRef, {
  action: swipeAction && { ...swipeAction, onCommit: onMoveToOtherCategory },
  rowsLeavingWith: (id) => …,
});
```

That seam exists for PLAN. A section over a different shape of data — several
entities combined rather than one project tree — picks the gesture up by
rendering the same card and supplying its own action and its own
`rowsLeavingWith`. Nothing in the gesture mentions `ProjectStatus`, categories or
moving.

The action is read through a ref, so a caller rebuilding the object every render
cannot restart the gesture; only *whether there is one* is a dependency.

### Where the action comes from

`projectSwipe.ts` holds a list of which sections can be swiped out of; the label
and icon come from `categoryMoveAction` in `projectMenu.ts`, so the swipe and the
menu item cannot end up naming the same move differently. **Adding a section's
swipe later is an entry in that list, not new gesture code.**

Committing calls the same `onMoveToOtherCategory` the menu does, so the landing
rule, the optimistic update and the reveal animation in the destination are all
the existing ones. The swipe adds no state and no API call of its own.

## Known issues

| | |
|---|---|
| No mouse swipe | Touch only, by construction — see above. The ⋮ menu covers desktop. |
| ACTIVE and PLAN have no swipe | ACTIVE's demote stays behind the menu on purpose. PLAN has no swipe because it has no data: `ProjectStatus` is `ACTIVE \| BACKLOG`, the PLAN section renders no rows, and "Add to Plan" is a stub. |
| A very narrow pane saturates the travel | The commit distance floors at 56 px, which is wider than a row when the dispatcher is dragged near `DISPATCHER_MIN_PANE_WIDTH`. The row runs out of room and the finger keeps going; it still commits. |
| A row detached mid-swipe holds the scroll lock | Only until the next touch anywhere in the list, which releases it. Needs another session to have moved that project while this one was swiping it. |
