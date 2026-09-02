# Rich text

The formatted body of `Field`, and the toolbar that drives it. Covers the
decisions that are **not** obvious from reading the code — mostly places where
the straightforward approach was tried and does not work.

Code: `mobile/src/ui/text-field/richText/`, `RichTextToolbar.tsx`, `toolbar/`.
The shell it sits in is in [`ui-primitives.md`](ui-primitives.md).

---

## Shape of the thing

```
Field                     dispatches on `formatting`, one prop shape either way
└─ FieldShell             label, chrome, geometry — knows nothing about its body
   └─ RichTextField       TipTap: extensions, markdown in and out, focus report

ActiveFieldProvider       holds whichever formatted field has focus
└─ RichTextToolbar        one bar for the whole form, portalled into that field
   ├─ toolbarControls     what the buttons are and what they do
   ├─ useToolbarMarks     what is currently on, read through the adapter
   └─ adapter             the only thing the bar knows about an editor
```

One toolbar per **form**, not per field. A form with two formatted fields draws
one bar, and the field primitive never learns about positioning or keyboards.

`RichTextToolbar` answers three questions and nothing else: what to draw, what
is on, and where to sit. Adding or removing a button is an edit to
`toolbarControls.tsx` alone.

---

## TipTap, and the extension set

TipTap (headless, over ProseMirror) replaced Lexical. Both are frameworks
rather than finished editors — neither ships a toolbar — so the swap cost
nothing above `toolbar/adapter.ts`. What it bought was the checklist and links.

**The checklist is a real `<input type="checkbox">`** in a
`contenteditable="false"` label. Lexical's is an `<li role="checkbox"
tabindex="-1">` that takes DOM focus when tapped, which cost the caret, the
toolbar, the space key and iOS's Paste callout in four different-looking ways,
and its 32px touch hit-zone swallowed taps meant for the words. A real input
has native hit-testing and never touches the caret.

**Structural toolbar actions apply across a multi-line selection.** In Lexical
they silently applied to the caret's line only.

**Links are a maintained extension** rather than a TODO.

What the swap did *not* fix, because none of it is the editor's doing: the
white bands between selected list items, the sheet claiming selection-handle
drags, and iOS's Paste callout. Those are properties of a contenteditable
inside an `IonModal` on iOS and behave identically either way.

The extension set is deliberately **only what the markdown serializer can
write** — paragraphs, ordered/bulleted/task lists, bold, italic, links.
Headings, code, quotes, rules, strike and underline are off. So is `hardBreak`:
markdown has no unambiguous single-line break, so a soft break would not
survive a save. Registering anything else would let a paste introduce content
the field is unable to store.

## Markdown is the stored format

`Project.context` stays a `String` that reads in the database, renders in any
future client, needs no HTML sanitisation, and is not coupled to any editor's
serialization version.

`richText/markdown.ts` is hand-written, both directions. `tiptap-markdown` was
rejected on maintenance grounds: 0.9.0, one maintainer, last published
September 2025 while TipTap itself shipped through 3.30 — not a dependency to
put directly on the persistence layer. The format is five features wide, which
is small enough to own.

**The task-list rule must be tried before the bullet rule.** A checklist line
begins with the same `- ` a bullet does, so read in the other order
`- [ ] buy milk` becomes a plain bullet whose text starts `"[ ]"`. That
ordering **cannot be tested through the round trip** — the mis-parse exports to
identical markdown. The test asserts on the node type instead.

Escaping is symmetrical and deliberately small: `\`, `*`, `_`, `[` and `]` are
escaped on the way out and unescaped on the way back, which is what makes the
round trip settle. Backticks are *not* escaped, because no code node exists for
them to be promoted into.

### What a save and a reopen actually do

A field holds whatever it last exported, so the property that matters is not
that arbitrary markdown survives untouched — it is that a value **stops
changing** once it has been through the editor. Its own output is stable;
bullet markers and a list starting at 3 are preserved; foreign markdown
normalises exactly once (underscore emphasis onto stars, a two-space indent
flattening to a sibling because it is not deep enough to nest).

The one thing the format cannot carry: markdown has no way to write "this
paragraph merely begins with the characters `1.`", and the serializer does not
escape a leading list marker the way it escapes an asterisk. So a paragraph
that looks like a list **is** one after a reopen. Asserted rather than
described, since it is the sort of thing that otherwise gets rediscovered as a
bug.

## An editor cannot be controlled

Writing `value` back on every render is how carets jump and IMEs break, so it
seeds once and is reseeded by remounting (`key`). That is the one silent
failure in the design, so it warns in dev when `value` changes from outside
without a remount.

Flipping a preset plain → rich changes what the stored string *means* (plain
text → markdown), so existing text containing `*`, `_`, `#` or a leading `1. `
starts rendering as formatting.

---

## Lists and checklists

Per-line toggling is built in: the list commands act on the block the caret is
in, split the list around it themselves, and apply across a multi-line
selection. `toggleList` in the adapter means "make this line this kind, or
plain if it already is", so one button both sets and clears.

This was the single largest piece of custom code under Lexical — a list type
belongs to the *list*, not the item, so changing one line meant splitting the
list around it, keeping the nesting wrapper in step, and renumbering only the
siblings that draw a number. All of it went with the swap.

**Ticking a box never moves the caret.** The checkbox is a real input in a
`contenteditable="false"` label, so it has native hit-testing: no synthetic tap
zone to steal taps meant for the words, and nothing that takes DOM focus away
from the editable. Tapping a box leaves the caret, the toolbar and the keyboard
exactly where they were.

**Tab never leaves the editor** (`tabGuard.ts`). When an item cannot sink any
further the list extensions decline the key, and with nothing claiming it the
browser falls back to focus traversal — which walks into the checklist's real
inputs and lights them up one by one, looking exactly like a screen reader had
switched itself on. The guard is registered at the lowest priority, so real
sink and lift still run first.

### Not every blur means the user left

iOS raises a blur when it puts up its Paste / Select callout — which it does
for a tap at a caret that is already there, on a plain paragraph as readily as
on a checklist. The caret stays in the text throughout, so dropping the toolbar
on that made it flicker away mid-edit.

`RichTextField` asks the DOM a tick later instead, once focus has landed
wherever it is going, and drops the toolbar only if the field really does not
hold focus any more.

When focus has genuinely gone it also **drops the selection**
(`staleSelection.ts`). A selection left behind in an unfocused field strands
that callout on screen, and tapping the highlighted text to get back in
re-raises the callout instead of placing the caret — leaving the field
reachable only by tapping text *outside* the old selection, which nobody would
guess.

That callout is iOS's own and cannot be suppressed from a web page. It appears
identically in a plain paragraph, which is how it was ruled out as ours.

### Typing a checkbox needs `[] `, not `- [] `

The task-item input rule is `/^\s*(\[([( |x])?\])\s$/` — anchored at the
start of the line, and it accepts no bullet at all. Typing `- ` first would
convert the line to a bullet the moment the space lands anyway. So `[] ` on its
own is the shortcut, including inside an existing list item.

---

## Block spacing, and why list lines are tighter

A selection highlight is painted block by block. WebKit fills the gap between
two selected **paragraphs**, so a paragraph break inside a selection is
invisible — but it paints an `<li>`'s selection at the **font box** (about
`1.17 x font-size`) rather than the line box, and does not gap-fill between
items. Whatever leading the item carries is left unpainted and shows as a
white band straight through the highlight.

Two things follow.

`--field-block-gap` is `0`, applied by `.field-editor > * + *` rather than by
a rule per block type, so no block boundary contributes a gap of its own.

`--field-list-line-height` is `18px` against the `22px` prose line, because
the band only closes at or below the font box:

```
band = line-height - 1.17 x font-size      22px -> ~4.5px,  18px -> 0
```

Prose keeps the roomier line; only list lines tighten. **Checklists are the
exception** and keep `--field-line-height`: `--checkbox-size` is `20px`, so a
line short enough to close the band is shorter than the box and consecutive
boxes collide. A checklist therefore keeps a hairline band when selected. A
numbered or bulleted line has no such floor, because its marker is text.

The structural fixes do not work. Each of these was tried on the simulator,
alone and in combination, and changed nothing — do not spend the afternoon on
them again:

- `display: block` on the item, with CSS counters instead of a native marker;
- `display: contents` on the `<ol>`, taking the list box out of the flow;
- moving the indent from the item's `margin-left` to the list's `padding-left`.

The combination also breaks numbering, since `display: contents` loses the
counter scope. Line height is the only lever.

### Markers cannot be styled from CSS

A list marker inherits from the `<li>`, not from the text inside it, so a fully
bold line drew an upright `1.`. The obvious fix is a selector —
`li:has(> p > strong:only-child)` — and it is wrong: `:only-child` counts
*elements*, so `plain **bold**` matches it too, and there is no selector for
"contains no unmarked text". CSS cannot express the question.

`richTextTiptap/markerFormatting.ts` asks the document instead, and decorates
the item with `field-listitem-bold` / `field-listitem-italic` when every text
node on its own line carries the mark. Nested lists are excluded — an item's
marker answers to its own line only. An empty line carries nothing, which is
why the marker is plain for the beat between pressing Enter and typing.

## Where the toolbar sits

Four attempts, and the failures are more instructive than the result.

### It is not docked to the keyboard

The first design put it above the keyboard, Apple Notes style. `useKeyboardInset`
read 0 in a browser, and the reason is structural: iOS shrinks the visual
viewport for the keyboard only when the *document* scrolls. Ionic locks the body
and scrolls inside `ion-content`, so iOS overlays the keyboard and leaves the
viewport alone — measured with the keyboard up, `innerHeight` and
`visualViewport.height` were both 714, where the same page outside Ionic reports
714 and 367.

`@ionic/core` has the identical limitation; its fallback is a `keyboardHeight`
config defaulting to 290, a device-specific number dressed as a constant. On
the test device the real height was 347.

### It is not positioned from JavaScript

The second design clamped the position in a `requestAnimationFrame` loop. It
looked right on a desktop and jittered on a phone: **iOS scrolls on the
compositor, and a rAF correction always lands a frame or two behind the content
it is chasing.** No amount of tuning fixes that — the position has to be decided
by the same thread doing the scrolling.

A scroll listener is no better, and fails for two further reasons worth
remembering: `ion-content` scrolls in its shadow root and only hands the
scroller over asynchronously, and iOS does not deliver scroll events during
momentum the way a desktop browser does.

### It is a sticky rail, and the stop point is just a gap

The bar sticks to the top of the field's own box at `--space-2`. There is no
viewport arithmetic in it at all — no measured pan, no `env()`, no correction.

It took a long time to get there, because the stop point is measured from
`ion-content` and `ion-content` was not where the visible area began: iOS pans
the locked document to lift the caret, dragging the container and everything
sticky inside it off the top. Four corrections were written for that, and each
was wrong on a surface it had not been tested on — clipped in both mobile
browsers, then 39px low in the installed app where `env(safe-area-inset-top)`
double-counted an inset Ionic had already spent, then gone off the top of a
real iPhone when that term was removed, since the inset reads `0` in simulator
Safari but not on a device.

None of it was fixable at this end. The pan is now released at source
(`system/keyboard/useReleaseKeyboardPan.ts`), so `ion-content` stays where it
is laid out and the stop point is simply a gap.

Two other placements were tried and are worse:

- **Inline, no sticky.** Correct on every surface and useless where it matters:
  on a long field, editing the last lines leaves the bar scrolled off the top,
  so every formatting action costs a scroll up and back.
- **Docked in the modal chrome.** `ion-modal` applies a transform, and a
  transformed ancestor makes `position: fixed` resolve against *it* rather than
  the viewport — so chrome inside the modal scrolls away exactly like content.
  Nothing placed inside the modal can be pinned to the screen.

> `env(safe-area-inset-top)` reads `0` in a browser tab and is real on a
> device, so a safe-area term verifies clean and ships broken. And the iOS
> Simulator hides the software keyboard whenever input is injected, so any
> keyboard test there passes against a viewport with nothing covering it —
> if the keyboard is not visible in the screenshot, the test proved nothing.

### A field with no label has no line to sit on

`.field-unlabelled` re-values `--field-label-line` to `0px`, so the bar anchors
to the field's own top edge and grows upward from there — over whatever is
above it. Both that token **and** `--rich-toolbar-rise` are restated in that
block, because a custom property resolves where it is *declared*: the `:root`
rise already baked the labelled value and would never see the override.

The cost is real and is the trade an icon-led row makes for having no label row
of its own: the bar covers the row above while the caret is in the field. It is
why the project form's goal and context rows are worth looking at with labels
before settling — `docs/modals.md` records both arrangements.

### It is anchored by its bottom

To the bottom of the label's line, at the right end of it. That is what keeps
the two heights independent: `--rich-toolbar-height` is free to change and the
bar grows *upward* from a fixed baseline, never into the input below. Centring
tied them together and pushed half of any extra height down over the field.

`--field-label-line` is a stated token rather than whatever the font gives,
because the bar is positioned against it.

## Known issues / watch list

| Issue | Detail |
|---|---|
| Chevrons stand in for indent icons | ionicons has no indent/outdent glyph, and none for bold or italic either — those are serif `B` and `I`, which is the universal convention. The chevrons read as navigation and carry their meaning only in the `aria-label`. |
| Buttons are below the touch target | 32px in a 40px bar, against `--touch-target: 44px`. The bar sits on a line built for 13px text; going bigger means giving the label row its own height. |
| Markdown round-trip normalises | `_italic_` is rewritten as `*italic*` and bullet markers converge on `-`. Bounded by the serializer being ours and asserted as settling after one pass, but not removed. |
| Checklists keep a hairline band when selected | Closing it needs a line at or below the font box (~17.5px), but the 20px checkbox needs more, so the two cannot both hold. Ordered and bulleted lists are fixed via `--field-list-line-height`; checklists are not. |
| A list item cannot indent twice | ProseMirror's `sinkListItem` needs a preceding sibling to nest into, and after one sink the item is the first child of the new inner list. iOS Notes has no such limit. Fixing it means letting a list item hold a bare list (`content: 'block+'`), a custom sink that wraps when `sinkListItem` declines, a markerless item in CSS, and a serializer that can write an item with no line of its own. |
| The modal header shifts up on the first focus | Only the first; blur restores it and the second focus is clean. Proportional to the browser's top chrome, so most likely the URL bar collapsing and the resulting document scroll being taken for a keyboard pan. Unconfirmed — the guard would be to release only while the keyboard actually covers the viewport. |
| The iOS edit menu overlaps the toolbar | The Cut/Copy/Paste callout is drawn by the OS next to the selection and cannot be suppressed, moved, or detected from a web view. The toolbar sits above the field, which is where the callout lands. The only real mitigation is moving the bar out of that zone — docking it above the keyboard. |
| Serialization per keystroke | A long context re-serialises on every key. Debounce if it ever shows. |
