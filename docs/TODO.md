# TODO

Work that is **not started**, recorded so it survives the conversation it came
out of.

This is not the same as the *Known issues / watch list* table each feature doc
carries. Those record limitations of something that exists and is shipped —
what it does not do, and why that was acceptable. This file is for work nobody
has begun, where the useful thing to write down is what would have to be
decided before starting.

---

## Links in the formatted field

A URL typed or pasted into a formatted `Field` stays plain text. It is not
coloured, not clickable, and stores as bare text. Verified rather than assumed:
pasting `https://example.com/docs` produces zero `<a>` elements.

This follows from the node set being deliberately *only what the pinned
markdown transformers can write* — see [`rich-text.md`](rich-text.md).
Registering a `LinkNode` without a matching transformer would let a paste
create content the field cannot store, which is the failure that constraint
exists to prevent. So this is a feature to add, not a bug to fix.

**Plumbing:** `LinkNode` and `AutoLinkNode` in `richText/nodes.ts`, the
`AutoLinkPlugin` (linking as you type) and/or `LinkPlugin`, the `LINK`
transformer added to the pinned array in `richText/markdown.ts`, and a
`validateUrl` that rejects `javascript:` — link targets are user input.

**Two decisions to make first**, both bigger than the plumbing:

- **What a click does inside an editor.** In a contenteditable a click normally
  places the caret. Plainly clickable links fight text editing: you can no
  longer put the caret inside a link to fix a typo in it. Notes and Notion
  diverge here — modifier-click, or a popover offering "Open".
- **How an external link opens in the installed app.** Navigating the WKWebView
  to another site replaces the app with a web page and leaves no way back; the
  user has to force-quit. It has to open in the system browser instead, which
  is app-level plumbing rather than something the field can own.

**One storage consequence worth agreeing to:** Lexical's `LINK` transformer
writes the `[text](url)` form, so a bare URL round-trips as
`[https://example.com](https://example.com)` rather than staying bare. It is
correct and reversible, just verbose in the database.
