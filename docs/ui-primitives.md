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

## Known issues / watch list

| Issue | Detail |
|---|---|
| No keyboard arrow navigation | The segmented control is a group of buttons; each is tabbable but arrow keys do not move between them as a native radio group would. Fine for now, worth revisiting when forms get long. |
| Breadcrumbs are single-line only | The line budget is one row. Wrapping to two would not remove the need for the algorithm — `flex-wrap` has no notion of which node matters — it would just run the same plan against a doubled budget. Left out because a header whose height depends on ancestry depth moves everything beneath it on every navigation. |
| One long name ends the row early | The first node that will not fit is clipped and nothing further is added, because skipping it would split the run and produce a third `…`. So a single very long ancestor hides every shorter name beyond it. Deliberate, but the most likely thing to want revisiting. |
| A clip can be a single pixel | The clipped node takes exactly what is left, which is sometimes 1–2 px less than its natural width — a barely-visible cut to the last glyph. Harmless, but it means "is this label clipped" is not a question the eye can always answer. |
| Selected-segment colour is from the concept, not the app | The concept fills the selected segment with `--accent` and white text. The app's other "selected" idiom (`.header-button.active`) is an `--accent-surface` fill with dark text. They disagree; pick one when the design settles. |
| `--segmented-index` clamps at 0 | When `value` matches nothing the index is floored to 0 so the transform stays valid. The indicator is hidden in that case, so it is invisible — but if the indicator is ever made unconditional, this becomes a wrong-looking selection. |
