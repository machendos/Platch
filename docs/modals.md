# Modals

How entity forms are presented. Covers the decisions that are **not** obvious
from reading the code — mostly places where the straightforward approach was
tried and does not work.

Code: `mobile/src/ui/Modal.tsx`, `mobile/src/modals/`

---

## Shape of the thing

Three layers, and the split is the whole point:

```
ui/Modal.tsx              presentation — how to be a sheet or a full page
(content, not yet built)  the fields; knows nothing about its container
modals/CreateProjectModal binds one content to one presentation and to data
```

**React has no `extends`.** A concrete modal does not inherit from an abstract
one, it *renders* one. Two layers would be enough for that, but not for the
requirement that drove this design: the same form body has to fill a bottom
sheet on a phone and a centred dialog on a desktop. With two layers the content
names its container and can only ever live there. With three, neither end
constrains the other.

The governing rule, inherited from `HeaderMenu`:

> **Ionic for behaviour, our markup for appearance.**

We take `IonModal`'s presentation, sheet gestures, focus trap, scroll lock,
back-button handling and keyboard avoidance. We take none of its form
components — the chrome is plain `<header>` / `<footer>` we style ourselves,
the same way `HeaderMenu` uses an `IonPopover` for positioning but builds its
own rows.

## Why `IonModal` rather than a hand-rolled overlay

Everything it brings is something that fails on a device and cannot be seen in
the preview browser: swipe-to-dismiss arbitration, keyboard avoidance, focus
trapping, background inerting, safe areas. The alternative was owning all of
that ourselves to avoid overriding Ionic's CSS — a trade the calendar's history
argues against in the other direction.

## Why `IonContent` is inside, in a system that avoids Ionic's UI

It is the one exception, and two behaviours depend on it:

- **The sheet gesture reads its `scrollTop`** to decide between dragging the
  sheet and scrolling the body. A plain `div` breaks that arbitration.
- **Keyboard avoidance is implemented on `ion-content`.** A thirty-field form
  on a phone is the whole reason `IonModal` was chosen.

It costs one override. `index.css` paints every `ion-content` with the page's
sunken grey, which would make every modal body grey; `.modal .modal-body` takes
the raised surface back, and wins on specificity regardless of source order.

## Why `mode="ios"` is pinned

Left on `auto`, Ionic resolves by platform — and it resolves to **material in
the preview browser** while resolving to iOS on device. Every `.ios`-scoped
override silently stops matching under material. `docs/calendar-layout.md`
records this as a bug that was live and unnoticed for a while. `HeaderMenu`
pins `mode` and the calendar pins mobiscroll's `theme` for the same reason.

## Presentation classes must not use Ionic's own names

`modal-sheet` and `modal-card` are **Ionic's internal class names** on
`ion-modal`; it adds them itself when `breakpoints` is set. Ours are
`modal-as-sheet` / `modal-as-page` so our rules are not in a specificity fight
with its layout. Verified: with a sheet presented, the host carries both
`modal-as-sheet` (ours) and `modal-sheet` (Ionic's).

## The sheet's corner radius takes a single value, not a shorthand

Ionic already rounds only a sheet's top corners, and it does it with logical
longhands:

```css
:host(.modal-sheet) .modal-wrapper {
  border-start-start-radius: var(--border-radius);
  border-start-end-radius: var(--border-radius);
  border-end-end-radius: 0;
  border-end-start-radius: 0;
}
```

Each takes **one** value. Setting `--border-radius: 14px 14px 0 0` makes every
one of them invalid, and all four corners fall back to `0` — square top corners
with no error anywhere. `--border-radius: 14px` is the fix, and Ionic's own
rule puts it on the right two corners.

## The desktop dialog needs a definite height

`--height: auto` collapses the body to zero and renders the dialog as a bare
52 px header. Ionic wraps the modal's light-DOM children in a
`div.ion-delegate-host.ion-page`, which is **absolutely positioned to fill the
wrapper** — so an auto-height wrapper has nothing to size against and the
absolutely-positioned child contributes nothing back.

A definite height is also what these dialogs want: they hold long forms that
should scroll at a stable size rather than resize as fields appear and vanish.
Measured at 1280×720: wrapper 560×576, header 52.5 + body 524.

## Safe areas are per presentation, and named so they are testable

Only the edges a presentation actually touches: a full-screen page insets top
and bottom, a sheet insets bottom alone, the desktop card floats clear of every
edge and insets nothing.

`--modal-safe-area-top` / `-bottom` are named rather than used inline for the
same reason `MainPage.css` names `--safe-area-bottom`: **`env()` reads `0px` in
a desktop browser and cannot be overridden**, so without the indirection none
of this is observable off-device. Verified by setting the variable on `:root`
in the preview browser — the header grew from 52.5 px to 99.5 px for a 47 px
inset and returned exactly on removal.

## Tokens live on `:root`, never on the page shell

`layout-config.ts` applies its variables to `.main-page-shell`. **Overlays are
portalled to `<ion-app>`, outside that div**, and inherit none of them. Modal
tokens are therefore on `:root`, in `index.css` for the app-wide set and at the
top of `Modal.css` for the modal's own — the same placement `HeaderMenu.css`
arrived at, and the same class of bug `index.css` records for `font-family`.

---

## The keyboard costs reach at both ends, and the modal pays it

A modal with a text field in it mounts two hooks from `system/keyboard/`.
Neither is optional and neither works without the other — they fix opposite
ends of the same session.

**`useReleaseKeyboardPan`** — Ionic locks the body and scrolls inside
`ion-content`. iOS does not know that: to lift the caret above the keyboard it
pans the *document*, and on a locked body that pan belongs to no scroller, so
nothing can scroll it back. That many pixels of the top are simply unreachable.
The hook moves the offset into `ion-content`'s own `scrollTop`, where it is an
ordinary scroll, and resets the document to zero. Net position is unchanged, so
there is nothing to see; the content just becomes reachable.

**`useKeyboardInset`** — a mobile browser does not shrink the layout viewport
when the keyboard opens, it covers the bottom of it. So the scroll range ends
where the content ends, with nowhere to lift the last lines to. The hook
publishes the covered height as `--keyboard-inset` and `.modal-body` reserves
it as bottom padding.

Both formulas are self-correcting across surfaces, so neither branches on
platform. In the installed app Capacitor's `native` keyboard resize shrinks the
webview itself, so there is no pan to release and `--keyboard-inset` computes
to `0` — correct, because the layout has already been made smaller. Measured:
`innerHeight` 844 -> 509 with `visualViewport.height` matching.

The symptom that identifies this whole class: **the unreachable amount at the
top and at the bottom always sum to the keyboard's height**, and how it splits
depends on where the caret was when the keyboard opened. If someone reports
"I can scroll almost to the end and it springs back", it is this.

---

## The project form

`CreateProjectModal` is the first form in the app that holds real values, so it
is also the first thing to give `Modal`'s `isDirty` a source. It is assembled
from blocks rather than written out: the header fields, `TargetComponent`, and
`TimeComponentsBlock`. Each block owns its own state and reports upward.

### A block reports, it is not controlled

Every block takes an `initial` value, freezes a baseline from it, and emits a
**report** — `{ isDirty, isValid, value }` — through one `onChange`. The
emission goes through an `onChangeRef` kept current in its own effect, so the
parent is free to pass an inline callback without the effect looping.

This is the opposite of the rule `src/ui` follows, where every primitive is
controlled. The reason is the baseline: "does this differ from what we opened
with" is a question only something holding the opening values can answer, and
lifting it into the modal would mean the modal knowing every block's shape.

### The target is stored as nulls, and the checkbox is not

`TargetDraft` is `{ timeNeededMinutes, minBlockMinutes, repetitionsNeeded }`,
each `number | null` — the `Project` columns themselves. Every tick in the
block is `!== null` on one of them, so there is no second representation that
could disagree with the value it describes, and `isDirty` is exact: a number
picked behind a box that is then unticked leaves nothing behind.

**The mode is separate, and has to be.** Neither target has a default, so a box
can be ticked with its field still empty — and nulls alone cannot tell that
from an untouched form. `TargetState` therefore carries `mode` beside the
value, and that ticked-but-empty state is exactly what `problems` reports.

### Switching target hides the numbers, it does not destroy them

`TargetState` carries a third field, `remembered`, holding what each input last
held. Switching to repetitions and back gives the time and its block straight
back; the count survives the same trip. Coming back to a target already filled
in and finding it blank reads as the form having thrown the work away.

Three things follow, and each is load-bearing:

- **Memory is not a value.** It sits outside `value`, so it is never saved and
  never counted as a change — a target filled in and then switched away from
  leaves the form clean.
- **Only the fields belonging to the mode come back.** The memory must not
  smuggle the other target in, or the exclusivity rule collapses.
- **A block the user's own edit invalidated is forgotten, not hidden.**
  Lowering the total below the block drops it from the memory too; restoring it
  later would put the field somewhere its wheel could never have reached.
- **The memory carries `dividable` as a flag, not only a number.** A block that
  is off has no number, so "off because the user turned it off" would read
  identically to "off because this target has not been opened yet" — and the
  second one is exactly what the default is for. Without the flag, a
  deliberately unticked line came back on after a trip to the other target.

A restored target opens with its panel **closed**. Ticking opens the wheels only
when there is nothing to show — a panel over an answered field asks a question
that has been answered.

### Goal and context are icon-led rows

They carry a glyph in a left gutter instead of a label, the way an event's rows
do — one line each until they have something to hold, stacked flush so their own
hairlines are the separators and the icons read as one column. `FieldShell`
draws the icon **inside** the field's box, so the focus fill covers the whole
row rather than starting after the glyph, and centres it on the *first* line so
a body that grows to two leaves it where it was.

**It costs the formatting toolbar its seat.** The bar anchors to the bottom of
the label's line; with no label it anchors to the field's own top edge
(`.field-unlabelled` re-values `--field-label-line` to `0px`, and restates
`--rich-toolbar-rise`, which a `:root` formula would otherwise have baked). It
then grows upward over the row above — so editing context covers most of the
goal row while the caret is in it. Reverting either field to a labelled row is
`label:` in place of `icon:` in `fieldPresets.tsx` and nothing else.

### The colour block has one shape and three permissions

`Color` is a fixed ordered palette — `{id, placement, hexCode}`, no names — so
it can only be chosen visually. The block is one row: what the colour *is* on
the left, the swatch on the right, and the palette opening inline underneath,
the same panel idiom the time fields use rather than a fourth kind of popover.

`availability` says what the hierarchy allows, and one rule covers all of it:
**the swatch is pressable exactly when this project owns its colour.**

| `availability` | left of the row | swatch |
| --- | --- | --- |
| `free` | `Color` | pressable |
| `locked` | `Color`, plus `From <parent>` | flat, not pressable |
| `overridable`, off | `☐ Unique color`, plus `From <parent>` | flat, showing the inherited colour |
| `overridable`, on | `☑ Unique color` | pressable |

Three things carry the design:

- **The checkbox appears only where there is a choice.** A project with no
  parent has nothing to opt out of, so it gets a plain label; one that may take
  its own colour gets the box. Ticking it is the same grammar as Dividable
  enabling its min block, so it needs no learning.
- **A colour that cannot be changed says where it came from.** A disabled
  control with no explanation reads as broken; `From Kitchen` under the row is
  what makes it read as inherited instead.
- **A locked swatch keeps its colour at full strength.** Only the chrome
  softens — the border and fill go, leaving a bare block of colour. Dimming the
  colour itself would say the colour is provisional, which is the opposite of
  what `locked` means.

**Eighteen colours as nine hues in two tones**, drawn as a 9-column grid so the
pairs line up in columns rather than by accident of wrapping. Grey is the ninth
column, which makes it `placement` 9 and 18 rather than 17 and 18 — the grid
fills row by row, so 17/18 would drop both greys into a third row side by side
instead of stacking them. The structure
is not decoration: it halves the number of decisions a person makes (pick a
hue, pick a strength), and it gives an obvious answer for a subproject that
wants to look related to its parent without being the same.

Two rules produced the values, and they are the fix for a palette that reads as
unbalanced:

- **Chroma is held steady; lightness follows the hue.** A palette looks wrong
  when its lightness varies for no reason — the set this replaced ran L\* 26 to
  91 across one row. Lightness that tracks hue is the opposite: yellow-ward
  colours are meant to be light and violet-ward ones deep, so respecting that
  makes eight colours look like one family. Holding lightness *flat* was tried
  and is worse in practice: it forces orange down to where it reads as rust.
- **Two columns are set by lightness rather than hue, and say so.** Orange
  keeps its own level because it is the lightest warm hue and the row's level
  turns it to rust. **Brown is not a hue at all** — it is orange held dark,
  which is exactly why it needs a column: no other column's tones can reach it.
  Both of brown's tones are pinned, because a pale tan collides with every
  other pale warm (it is what put `#c49a6c` and `#fdbf6f` 12.9 apart in the old
  set), so its light tone is a camel rather than a peach.
- **The eight hues are nameable, not optimal.** Maximising separation
  numerically produces fluorescent magentas and two greens that no one would
  call by different names. The hues were chosen first; the arithmetic only
  checks them.

**Each hue is taken near its own chroma ceiling, not to a shared one.** A single
cap makes the row read as secondary, because it is set by whatever the weakest
hue can manage. There is no even answer available: teal and blue top out around
C 48 at any lightness sRGB can express, while red and pink reach past 90. They
gain chroma only by getting lighter, and lighter walks them into their own light
tones — so they stay where they are and the rest of the row goes as strong as it
can.

Measured: minimum CIEDE2000 across all eighteen is 13.0, against 12.9 for the
21-colour set it replaces; the tightest column pair is 14.2. The three closest pairs are all pale warms — light
red, light orange, light brown, around 13 — which is the price of carrying red,
orange and brown at once, and the old set paid it too. Red and orange collapse under deuteranopia
(dE 2.0) — unavoidable while keeping both, since they differ mainly along the
axis that deficiency removes, and the old set had the same problem.

Ticking `Unique color` seeds from the **inherited** colour rather than from
nothing: it is always a legal answer, so the tick never leaves the field empty,
and the palette opens on it.

### Dirty is what would be saved, not what is on screen

Ticking a time target fills the block line in for you, which puts a number on
screen that the user never chose — and an incomplete target is not written at
all. So `isDirty` compares the **savable** draft: a target still missing its own
number contributes nothing, and closing a form where a box was merely ticked
does not offer to discard anything.

### Three rules the block enforces, none of which the user can trip over

- **Time and repetitions are exclusive.** Choosing one empties the other.
- **The backend can still send both**, which the form cannot draw. Time wins.
  Normalising runs once at open, over the baseline as well as the draft, so a
  broken record opens *clean* under the reading it will be saved with rather
  than pre-dirtied by a correction nobody made.
- **A block can never outlast the total it divides.** The min-block wheel stops
  at the total (`minBlockScale`), and a total lowered below an already-chosen
  block wipes that block — which unticks Dividable, because the two are the
  same null.

**A total too short to divide suspends the line rather than answering for it.**
At or below one block the checkbox goes **disabled and unticked** and stays on
screen: a row that vanishes reads as a bug, where a greyed one says the total
is what stands in the way. Nothing is decided, so nothing is lost — raising the
total brings the line back exactly as it was, ticked, at the block it held.

That is the whole reason `blockAt` and `withTimeNeeded` treat the two emptyings
separately. A total that cannot *hold* the chosen block is an answer, and the
memory forgets it; a total too short to divide *at all* is an obstacle, and the
memory is left untouched.

**Dividable starts on**, at the user's own `defaultEvenLengthMinutes` — most
projects are cut into blocks, so the common case costs no taps. That default is
a column on `User`, seeded from `DEFAULT_EVEN_LENGTH_MINUTES` by the service
rather than by a Prisma `@default`.

It applies to ticking the box in this session, **not** to opening a record: a
project already carrying a time target has decided about its block, so a stored
`null` there means the user said no and is left alone.

### How a save will find a bad field

`isValid` alone can say *that* something is wrong; it cannot say *where*, so it
cannot drive "scroll to it and paint it red". The report carries `problems`
instead, and each names its control by **DOM id** — never by a path through the
component tree. Depth then stops mattering: the form root concatenates
`problems` from every block, resolves them with `getElementById`, sorts by
`getBoundingClientRect().top` so "the first problem" means the topmost one on
screen, and scrolls to that one.

`PickerTrigger` and `Select` accept an `id` for this. What is **not** built yet
is the other half: a `showProblems` flag going back down, and an `invalid` state
on `FieldShell` to paint the hairline. Those land with the save path; the
time-components block starts reporting ids at the same time.

### The rows are not a primitive

`docs/ui-primitives.md` anticipated lifting the checkbox row into `src/ui`, on
the strength of two hand-rolled copies. Both were demos, and both are gone — so
`TargetComponent.css` is the only consumer and the row stays local. Lift it
when a second form asks for it.

## Known issues / watch list

| Issue | Detail |
|---|---|
| Keyboard avoidance unverified | The reason `IonContent` is inside has still not been exercised on a device. The project form is now a real one to try it with; it cannot be seen in Chromium. |
| Sheet drag unverified on device | Breakpoint, handle and radius were verified in Chromium; the actual drag-to-dismiss and drag-vs-scroll arbitration are touch behaviours and need the simulator. |
| No dark mode | The token layer defines one palette. `index.html` pins `color-scheme: light` and `variables.css` has no `prefers-color-scheme` block, so the modal matches the rest of the app — but the tokens are the place to add it. |
| Existing components still carry literals | The token layer was introduced with values lifted from what the app already draws, so nothing moved. The calendar, header and dispatcher still hardcode their own greys, radii and type sizes; they migrate as they are next touched. |
| `--modal-dialog-height` is a guess | `min(640px, 80vh)` was chosen before any real form existed. Revisit once the project form has its true length. |
| A min block is not checked against the total on the way in | The wheel cannot offer one that is too long, and lowering the total wipes it — but a record arriving from the backend with `minBlockMinutes > timeNeededMinutes` is shown as stored. Validation belongs with the save path that does not exist yet. |
| The wheels cannot be driven in the preview browser | `requestAnimationFrame` does not run in a hidden pane, so a synthetic tap computes the right target and then never animates to it. The scale rules are covered by `targetState.test.ts`; picking a duration by hand needs the simulator. |
