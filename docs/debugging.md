# Debugging

Tools kept in the repo for problems that ordinary means cannot reach, and the
reasoning that made them necessary.

Code: `mobile/src/system/maintenance/`

---

## `settleTrace` — what an element does after an interaction

`traceSettle(label, find)` samples an element on every frame for forty frames
and prints the result into the page as text.

**It is not wired to anything.** Nothing imports it. Wire it up when you need
it, then take the call back out — that is deliberate, and the reason is below.

### When it earns its place

A screenshot cannot resolve a one-frame flash, and there is no console on a
device. Reach for this when something moves and you cannot say what moved it:
a row that lands twice, an animation nobody asked for, a jump you can see but
cannot catch.

### Using it

Call it from the handler that ends the interaction, guarded so it cannot ship:

```ts
if (import.meta.env.DEV) {
  traceSettle('drop', () => document.querySelector('[data-project-id="…"]'));
}
```

Then open the app with `?trace=1`. The flag is stored, so a router that drops
the query string does not turn it off again; `?trace=0` stops it.

### Reading it

```
top    (26): 671 671 449 449 476 501 … 665
offset  (2): 503 503 216 216 216 216 … 216
scroll  (1): 0 0 0 0 …
translate: 0px -215.727px | 0px -188.228px | … | none
running: Animation@250ms
```

- **`offset`** is the layout position. It ignores scrolling and transforms.
- **`scroll`** is the nearest scrolling container.
- **`top`** is what is actually painted.
- **`running`** names every animation the browser reports on the element.

The three positions are what make it useful, because each pair rules something
out. `top` moving while `offset` and `scroll` hold still can only be an animated
transform — and `running` then names it. In the trace above, the layout was
correct from the first frame and the container never moved, so nothing was
wrong with where the row went; something was drawing it somewhere else for
twenty-four frames.

### Why it is not left wired up

It shipped, when it was. An unconditional import puts it in the production
bundle — confirmed by building and finding it there. Two things are needed to
keep it out, and the first alone is not enough:

- Guard the call with `import.meta.env.DEV` so the branch is dead in a build.
- Keep the module free of work at load time. It reads its flag on first use,
  not at module scope, because a side effect up there anchors the module and
  defeats tree-shaking even when every caller is gone.

---

## What it found, and why reading source was not enough

The dispatcher's rows slid from where a drag began to where it landed, after
the finger had already carried them there.

`useSortable` was passed `transition: null` to disable exactly that. The
abstract `Sortable` honours `null` — `if (!transition) return` — so reading
that source said the animation was off. It was not. The React binding does:

```js
// @dnd-kit/react/sortable.js
const transition = {...defaultSortableTransition, ...input.transition};
```

Spreading `null` contributes nothing, so `null` silently restores the very
default it was meant to remove: 250ms, `cubic-bezier(0.25, 1, 0.5, 1)`. Only
`{ duration: 0 }` disables it.

Two rounds of reading the library produced two confident wrong answers. One
trace produced the right one, because `running: Animation@250ms` is not an
inference. That is the whole argument for keeping the tool in the repo.
