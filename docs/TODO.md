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
