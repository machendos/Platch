# Rich text

The formatted body of `Field`, and the toolbar that drives it. Covers the
decisions that are **not** obvious from reading the code — mostly places where
the straightforward approach was tried and does not work.

Code: `mobile/src/ui/text-field/RichTextField.tsx`, `RichTextToolbar.tsx`,
`richText/`. The shell it sits in is in [`ui-primitives.md`](ui-primitives.md).

---

## Shape of the thing

```
Field                       dispatches on `formatting`, one prop shape either way
└─ FieldShell               label, chrome, geometry — knows nothing about its body
   └─ RichTextField         Lexical: composer, plugins, markdown in and out
      └─ ReportFocusPlugin  tells the provider this field has the caret

ActiveFieldProvider         holds whichever formatted field has focus
└─ RichTextToolbar          one bar for the whole form, portalled into that field
   ├─ toolbarControls       what the buttons are and what they do
   └─ useToolbarMarks       what is currently on, read from the selection
```

One toolbar per **form**, not per field. A form with two formatted fields draws
one bar, and the field primitive never learns about positioning or keyboards.

`RichTextToolbar` answers three questions and nothing else: what to draw, what
is on, and where to sit. Adding or removing a button is an edit to
`toolbarControls.tsx` alone.

---

## Lexical, and the node set

Chosen because the required features map onto built-ins rather than custom
nodes: checklists are a first-class list type, list Enter/backspace-outdent
comes with `@lexical/list`, and it was written for Facebook's mobile web, so
WebKit is a first-class target rather than an afterthought.

The node set is deliberately **only what the pinned transformers can produce** —
core paragraph/text plus `ListNode` / `ListItemNode`. Bold and italic are text
formats and need no node. Registering nodes the markdown set cannot write would
let a paste introduce content the field is unable to store.

## Markdown is the stored format

`Project.context` stays a `String` that reads in the database, renders in any
future client, needs no HTML sanitisation, and is not coupled to Lexical's
serialization version.

`richText/markdown.ts` **pins** the transformer array rather than using
Lexical's `TRANSFORMERS`, which grows with the library: an upgrade could
otherwise start writing headings or code fences into a field nothing else can
render back.

**`CHECK_LIST` must precede `UNORDERED_LIST`.** Its pattern begins with the
same bullet, so reversed, `- [ ] buy milk` parses as a plain bullet whose text
starts `"[ ]"`. Lexical deliberately leaves `CHECK_LIST` out of
`ELEMENT_TRANSFORMERS` rather than ordering it for anyone.

That ordering **cannot be tested through the round trip** — a mis-parse exports
to the identical markdown. The test asserts on the node type instead.

### What a save and a reopen actually do

A field holds whatever it last exported, so the property that matters is not
that arbitrary markdown survives untouched — it is that a value **stops
changing** once it has been through the editor. Its own output is stable;
bullet markers and a list starting at 3 are preserved; foreign markdown
normalises exactly once (underscore emphasis onto stars, a two-space indent
flattening to a sibling because it is not deep enough to nest).

The one thing the format cannot carry: markdown has no way to write "this
paragraph merely begins with the characters `1.`", and Lexical does not escape
a leading list marker on export the way it escapes a backtick. So a paragraph
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

## One line at a time

Lexical's list commands are written for a document toolbar, where the unit of
formatting is a block of selected text. Both are too broad for a per-line
toggle:

- `$insertList` takes the whole containing `ListNode`, moves every child into a
  new list of the target type and replaces it — ticking one line turned all of
  its siblings into checkboxes.
- `$removeList` climbs to the *top* list and flattens every item at every depth
  into paragraphs — unticking one line collapsed the whole field into loose
  lines.

What makes this awkward is that **a list type belongs to the list, not to the
item**. One line cannot differ from its siblings while it shares their
`ListNode`, so changing a single line means splitting the list around it.
Everything in `lineList.ts` is built on that one operation.

Three things fell out of it that were not obvious:

- **Nesting is a list inside a list *item*, and an item may hold only one
  list.** At depth the wrapper has to split alongside the list it holds, or two
  lists land in one item and Lexical merges their text together.
- **Only siblings that draw a number may be counted** when renumbering the
  remainder. A nesting wrapper is a sibling in the tree that shows nothing of
  its own, so counting it leaves a visible gap: `1.` / `a. b.` / `[ ]` / `3.`
- **A line that leaves a list has to be able to rejoin one.** The first version
  only handled a line that was already a list item, so the buttons did nothing
  on a line that had just been unlisted. A line arriving from outside joins the
  run beside it when that run is the same type — without that the toggle is not
  reversible and leaves three lists where there was one.

Unlisting a **nested** line is deliberately left undone: a paragraph cannot sit
inside a list item, so it means lifting the line out of every list above it and
putting it back in the right place. Outdent first.

### The checklist interaction is ours, not Lexical's

`CheckListPlugin` is not used. It is written for a document where a checkbox is
a control in its own right, and in a text field that model fights the caret.
`CheckListTapPlugin` replaces it and does exactly one thing: if a click landed
on the marker, toggle that item. No focus changes, no key handlers.

Two separate defects drove that, and the first was fixable with Lexical's own
`disableTakeFocusOnClick` while the second was not.

**It moved DOM focus to the `<li role="checkbox">`,** which produced four
symptoms that looked like four separate bugs:

- **The toolbar vanished.** Lexical fires `BLUR_COMMAND` when the editable
  loses focus, so the field stopped being the active one.
- **Space toggled the checkbox instead of typing.** `KEY_SPACE_COMMAND` fires
  whenever a check `<li>` holds focus — that is the accessible checkbox
  behaviour, and it is wrong when the caret is supposed to be in the text.
- **iOS showed its Paste / Select callout.** Focus sat on a non-editable
  element with no text selection, so the OS offered the element menu rather
  than a caret menu.
- **It felt random.** Whether focus landed on the `<li>` depended on exactly
  where the tap fell, and there is a separate touch/pointerup path with its own
  dedup window.

**And its touch hit-zone reached into the text.** `clickAreaPadding` is
hard-coded to 32px on touch. The marker is 20px wide and the text begins 28px
in, so the checkbox owned everything up to 52px — on a short line, most of the
word. Tapping to put the caret in your own text toggled the checkbox instead,
and no option turns that off.

Ours pads by 4px, bounded by the gap rather than chosen for comfort: it may not
reach the text. That makes the target smaller than the 44px Apple asks for,
which is the honest cost of a marker this size — the alternative is a target
that steals taps meant for the words. `checkListTap.test.ts` asserts the
boundary.

The cost is the keyboard affordance: you can no longer tab to a checkbox and
press space, and arrow keys no longer step between markers. In a text field the
caret model matters more, and the toolbar's checklist button is the
alternative.

### Not every blur means the user left

iOS raises a blur when it puts up its Paste / Select callout — which it does
for a tap at a caret that is already there, on a plain paragraph as readily as
on a checklist. The caret stays in the text throughout, so dropping the toolbar
on that made it flicker away mid-edit.

`ReportFocusPlugin` asks the DOM a tick later instead, once focus has landed
wherever it is going, and drops the toolbar only if the field really does not
hold focus any more.

That callout is iOS's own and cannot be suppressed from a web page. It appears
identically in a plain paragraph, which is how it was ruled out as ours.

### Typing a checkbox needs `[] `, not `- [] `

Markdown shortcuts are first match wins. `- ` matches `UNORDERED_LIST` the
moment the space lands, so the line is already a bullet before `[]` is typed
and the dash is gone. `CHECK_LIST`'s pattern makes the bullet optional, so
`[] ` on its own converts — including inside an existing list item.

---

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

### It is a sticky rail

The toolbar hangs off a zero-height, zero-margin element at the field's top
edge, `order: -1` so the portal may append it anywhere. Sticky is bounded by
its containing block — the field — so all three rules fall out of the browser
rather than out of arithmetic:

- it sits above the field,
- it stops at the top of the scrolling area,
- it leaves when the field's bottom rises past the stick point.

`FieldShell` spaces its label with a **margin rather than `gap`** because of
this. A zero-height flex item is still an item, and `gap` would space it —
focusing a formatted field would nudge everything below it by 4px.

### It is anchored by its bottom

To the bottom of the label's line, at the right end of it. That is what keeps
the two heights independent: `--rich-toolbar-height` is free to change and the
bar grows *upward* from a fixed baseline, never into the input below. Centring
tied them together and pushed half of any extra height down over the field.

`--field-label-line` is a stated token rather than whatever the font gives,
because the bar is positioned against it.

### The ceiling is the keyboard pan, not the browser chrome

The last bug, and the two wrong diagnoses before it are worth recording.

The toolbar was clipped at the top of the screen in both mobile browsers.
It is **not** browser chrome covering the layout viewport: measured on both,
`visualViewport.offsetTop`, `env(safe-area-inset-top)` and `lvh - dvh` were all
`0`. It is **not** the sticky offset: clearance from `ion-content` held at
exactly 24 the whole time.

`ion-content` itself was off screen. The browser's own "scroll the focused
input above the keyboard" acts on the **document**, and drags `ion-content` —
with everything sticky inside it — up past the top. Its top read `-88` in
Chrome and `-122` in Safari, matching `document.scrollingElement.scrollTop` and
`visualViewport.offsetTop` exactly in both.

So the ceiling adds `--visual-viewport-top`
(`system/viewport/useVisualViewportTop.ts`). **Nothing in CSS reports this:**
`env(safe-area-inset-*)` describes the device's cutouts and reads 0 in a
browser tab; `lvh`/`svh`/`dvh` give chrome heights without saying whether the
missing part is at the top or the bottom. The visual viewport is the only thing
that knows, and it is JavaScript-only.

It is **not** the per-frame chase that jittered: it changes when the keyboard
opens, closes or re-pans, and everything reading it stays CSS, so the sticky is
still the compositor's.

> A synthetic scroll proves the arithmetic and says nothing about whether the
> real event ever arrives. Setting `scrollTop` and dispatching a `scroll` event
> is how a broken version passed its check twice. Anything scroll-driven or
> keyboard-driven has to be seen on a device.

---

## Known issues / watch list

| Issue | Detail |
|---|---|
| Chevrons stand in for indent icons | ionicons has no indent/outdent glyph, and none for bold or italic either — those are serif `B` and `I`, which is the universal convention. The chevrons read as navigation and carry their meaning only in the `aria-label`. |
| Buttons are below the touch target | 32px in a 40px bar, against `--touch-target: 44px`. The bar sits on a line built for 13px text; going bigger means giving the label row its own height. |
| Unlisting a nested line does nothing | Outdent first. Asserted as a test so it reads as a decision rather than a gap. |
| Markdown round-trip normalises | Lexical rewrites `_italic_` as `*italic*`; pinning the transformer array bounds this but does not remove it. |
| Serialization per keystroke | A long context re-serialises on every key. Debounce if it ever shows. |
