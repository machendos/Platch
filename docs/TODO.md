# TODO

Work that is **not started**, recorded so it survives the conversation it came
out of.

This is not the same as the *Known issues / watch list* table each feature doc
carries. Those record limitations of something that exists and is shipped —
what it does not do, and why that was acceptable. This file is for work nobody
has begun, where the useful thing to write down is what would have to be
decided before starting.

---

## What a link click should do

Links **exist** — `richText/extensions.ts` configures TipTap's Link extension
with `autolink`, so a URL typed or pasted converts itself, and the serializer
round-trips `[text](url)`. Verified on device.

What is *not* decided is what happens when one is tapped. `openOnClick` is
currently **off**, so a link is coloured and stored but inert. Two decisions
have to be made before turning it on, and neither is about the editor:

- **What a click does inside an editor.** In a contenteditable a click normally
  places the caret. Plainly clickable links fight text editing: you can no
  longer put the caret inside a link to fix a typo in it. Notes and Notion
  diverge here — modifier-click, or a popover offering "Open".
- **How an external link opens in the installed app.** Navigating the WKWebView
  to another site replaces the app with a web page and leaves no way back; the
  user has to force-quit. It has to open in the system browser instead, which
  is app-level plumbing rather than something the field can own.

**One storage consequence already in effect:** a bare URL round-trips as
`[https://example.com](https://example.com)` rather than staying bare. Correct
and reversible, just verbose in the database.

---

## First and last date of a recurring time component

A recurring cadence is stored with `recurringStartDate`, and an interval above
one is ambiguous without it — "every 2 weeks on Tu" needs to know which week
counts. The editor shows no field for it, and nothing yet says whether a
cadence can end.

Until that is decided, `currentRecurrenceAnchor()` in
`mobile/src/modals/components/timeComponents/timeComponentsState.ts` stands in:
the current day anchors a created component's `recurringStartDate` and prefills
the weekday / day of month / month a new cadence starts from. It is the one
place to replace when first and last dates become a real decision — whether
they get fields of their own, follow the project's earliest/deadline dates, or
stay implicit.

---

## Responsive dispatcher, and who owns a size

Deferred until after the drag-and-drop work. The pane will get breakpoints in
**both** directions — vertical shrinks the section header, horizontal shrinks
type, control sizes and the spacing inside a card, and changes which controls
appear at all. Four things were worked out before deferring, and each fails
silently if rediscovered wrong.

**A container query and `layout-config.ts` do not conflict, but they cannot both
own a number.** `layoutCssVariables` is an inline style on `.main-page-shell`,
so those values are *defaults*; a `@container` rule on a descendant overrides
them for that subtree, because custom properties inherit and the nearer
declaration wins. The cascade is fine. What breaks is ownership, and the test is
what actually needs the number:

- **CSS only** → declare it in CSS. `DIVIDER_SIZE` has no TS consumer at all and
  sits in `layout-config.ts` for no reason.
- **JS needs it and it is responsive** → CSS owns it, JS *reads* it, with
  `getComputedStyle(el).getPropertyValue('--…')`.
- **JS only, not visual** → stays TS: `DEFAULT_PANE_WEIGHTS`, storage defaults.

That keeps one source of truth and no drift, which is what the rule in
`CLAUDE.md` is protecting; only the side holding the value changes.

**One incoherence is already waiting.** `useSectionResize` measures the sections
from the DOM (line 14) and then clamps with the *imported*
`DISPATCHER_SECTION_HEADER_HEIGHT` (line 28). The moment a vertical breakpoint
shrinks that header, the clamp floors at the old number and a section stops
shrinking to its own header. The fix is to read the resolved custom property off
the element the hook already measures.

**Vertical breakpoints need `container-type: size`, not `inline-size`.**
`inline-size` — what `Modal.css` uses — can only query width. `size` adds block
axis containment, which computes the box as if it had no contents. That costs
nothing here: `.dispatcher` takes its width from the workspace's inline
`gridTemplateColumns` track and its height from the shell's `100dvh` flex
column, and its own `fr` rows already prove the height is definite. The rule to
preserve is that nothing inside may ever become the source of the pane's height.

**The container must be an outer wrapper, with the tokens re-valued on
`.dispatcher` itself — the opposite nesting from `Modal.css`.** A container
cannot style itself, and `Dispatcher.tsx` builds `gridTemplateRows` as an inline
style *on `.dispatcher`*, reading `minmax(var(--section-header-height), …)`.
Re-value the tokens on an inner wrapper instead and that inline grid keeps the
outer value, so row heights quietly stop matching the headers they are meant to
fit.

Note when this lands: `useSectionResize` requires exactly three
`.dispatcher-section` nodes under its ref. Wrapping the *pane* is fine; wrapping
the *sections* is not.
