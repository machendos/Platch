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

## Known issues / watch list

| Issue | Detail |
|---|---|
| Keyboard avoidance unverified | The reason `IonContent` is inside has not been exercised on a device — there are no fields yet. Check it with the first real form, on the simulator; it cannot be seen in Chromium. |
| Sheet drag unverified on device | Breakpoint, handle and radius were verified in Chromium; the actual drag-to-dismiss and drag-vs-scroll arbitration are touch behaviours and need the simulator. |
| No dark mode | The token layer defines one palette. `index.html` pins `color-scheme: light` and `variables.css` has no `prefers-color-scheme` block, so the modal matches the rest of the app — but the tokens are the place to add it. |
| Existing components still carry literals | The token layer was introduced with values lifted from what the app already draws, so nothing moved. The calendar, header and dispatcher still hardcode their own greys, radii and type sizes; they migrate as they are next touched. |
| `--modal-dialog-height` is a guess | `min(640px, 80vh)` was chosen before any real form existed. Revisit once the project form has its true length. |
