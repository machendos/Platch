# Timezones

Where the device has been, as a timeline, and what the calendar draws from it.

Code: `mobile/src/features/timezone/`, `backend/src/user/timezone-change/`.

The whole feature lives in one folder — the timeline read, the zone watch, the
dialog, the strips, the offline queue and both gateways — rather than spread
across `api/`, `config/`, `pages/` and `system/` as it was.

---

## The timeline is a list of assertions, not deltas

A `TimezoneChange` row says **"from this instant, this zone"** — one instant
column (`changesAt`), one zone. It is not a delta and not a pair of zones, which
is what makes a row inserted out of order harmless: the reader always walks the
sorted list and takes the last assertion at or before the moment it is asking
about. A second device writing a row for last Tuesday needs no reconciliation.

`zoneAtMoment(history, moment)` in `useTimezone.ts` is that read.

### It returns null on an empty timeline, deliberately

A renderer wants a zone whatever happens, so the hook's `getTimezoneOnMoment`
appends `?? currentDeviceTz()`. The **watch** must not get that fallback: it is
asking "does the timeline already account for where the device says it is?", and
answering with the device's own zone makes the comparison agree with itself.
That is not a style point — with the fallback inside, a fresh account never
records its first row, because the first check always concludes it already knew.

### `Temporal.Instant.compare`, never `>`

Temporal throws from `valueOf` on purpose, so `changesAt > instant` is a
`TypeError`. It hid for a long time because the guard clause was written as
`history.length === 0 ? … : …` *after* a `findIndex` — and `findIndex` on an
empty array never runs its predicate. Empty timelines worked; the first real row
would have thrown.

## The surface the rest of the app sees

`api/timezoneChanges.ts` exposes three things and nothing else:

| | |
|---|---|
| `useTimezoneChanges()` | the timeline, for rendering |
| `readTimezoneChanges()` | the timeline as it stands now, for deciding what to write |
| `recordTimezoneChange()` | record a change |

That a change is held on the device before it is sent, that reads are cached,
that a queued row and a stored row are two sources merged into one timeline —
all of that is behind those three. A caller that had to know which it was
talking to would have to keep knowing, and every one of those details has
already changed once. Callers do not mint queue ids, ask for a flush, or hold a
query key; the outbox retries on its own, on `online` and on becoming visible.

**The local queue is read with `networkMode: 'always'`.** It reads the device,
not the network. On the default an offline device *pauses* it — so the rows
held precisely because the device is offline would be the ones that stopped
reaching the calendar, and the read the watch depends on would never settle.

## Recording

`useTimezoneWatch` decides when to look; `recordDeviceZone` does the looking;
`api/timezone.changes.queue.ts` holds what cannot be sent yet.

### Signing in is a moment to look, not just the app coming back

Signing in is the first point at which the timeline can be read at all, and
nothing else re-runs the check until the app is next resumed. Without it a new
account stays unrecorded for as long as it takes the user to reload the page —
which is exactly what it looked like.

### The first row is a baseline, and says nothing

A change recorded against an empty timeline is not a move: there is nowhere it
moved *from*. It is recorded and not announced, so signing up does not greet
someone with "you're now in Eastern Time" about the place they already are. The
dialog is for a zone recorded against a timeline that held a different one.

### Triggered by the app coming back, not by a timer

iOS suspends the app for the whole flight, so a timer does not run during the one
event it exists to catch. The meaningful moment is the resume: `appStateChange`
from `@capacitor/app` inside the native shell, `visibilitychange` in the browser
and simulator Safari, plus the first mount.

### The write is local first

Detection fires when someone steps off a plane, which is exactly when the network
is worst. A straight POST loses the observation, and **an observation cannot be
retaken** — nothing anywhere else records where the device thought it was at that
instant. So it goes to `deviceStorage` first and is sent afterwards.

Pending rows are **their own query**, not an optimistic write into the server
query's cache. An optimistic row is wiped by the next refetch — a window focus is
enough — which would take the row off the calendar while it was still sitting
unsent. Two sources, merged by the reader.

### One check at a time

The triggers overlap by nature: a resume makes the document visible, so
`appStateChange` and `visibilitychange` arrive together. Each check holds an
unchanged view of the timeline across the confirm wait, so two of them both
conclude the zone is unrecorded and both record it. A module-level single-flight
guard drops the overlapping call, which loses nothing — it would read the same
device zone as the one already running. Found by React StrictMode's double mount
producing two rows 3 ms apart; two real triggers within the confirm window do the
same thing.

### Queue writes take turns

Every queue write is read-modify-write on one storage key, and `enqueue` starts a
flush without awaiting it, so the two overlap routinely. A flush that began
before a change was queued would write back a list that never contained it. Two
things keep it: mutations are serialised, and a flush removes only the ids it
actually sent from whatever the queue holds *then*, rather than overwriting it
with the snapshot it started from.

Serialising the writes is not enough on its own. Every trigger the watch has
calls flush — mount, a resume, coming back online, and `enqueue` itself — so two
flushes routinely overlap, and two that read the same pending row both send it
before either removes it. That put the same change on the server twice, with an
identical instant and device id. Flushes share one in-flight promise, so an
overlapping call waits for the one already running.

### Being signed out is the api client's business, not this feature's

`authenticatedFetch` refuses an unauthenticated request instead of sending one
that can only answer 401, and `getPublicConnection` exists for the two endpoints
whose job is to get a session in the first place — signing in and signing up.

Nothing here asks about tokens. A refused request reaches the queue and the
timeline read as an ordinary failure, which they already handle: the row stays
queued, the read falls back to the cache. That is also what lets a change be
recorded before the account exists and sent once it does.

The redirect still happens from the api client, because nothing else guards the
routes — without it a signed-out user sits on a page that can load no data. It
spares `/login` **and** `/register`, so a background flush during sign-up cannot
pull someone off the form that would give them a session.

### The check never waits on the network

Two different ways the plain query stops a check, both of which abort it before
the observation is queued:

| | |
|---|---|
| Signed out | the api client refuses the request rather than sending it, and the read rejects |
| Offline | `networkMode: 'online'` **pauses** the query — the `queryFn` is never attempted and the promise never settles |

`timezoneChangesForCheck` therefore asks only when a token exists, and races the
answer against a 3 s timeout onto whatever the cache holds. With `retry: 2` and
backoff, a *failing* server also takes longer to give up than the watch is
willing to wait, so that path resolves off the timeout too.

### Both sides of the comparison are canonicalised

ICU does not agree with itself about which alias is primary — this machine
resolves `Europe/Kyiv` to `Europe/Kiev` and leaves `Asia/Calcutta` alone — and
which direction it picks varies by version, so a build machine and a phone can
disagree. Comparing a canonical device zone against a raw stored one appends a
duplicate row **on every launch** for anyone in Kyiv or Kolkata. `canonicalZone`
caches, because the calendar asks once per visible day.

### A zone is re-read before it is trusted

Devices report a transient zone while the network hands over. With no way to
correct a row from inside the app yet, one bad write is permanent, so the zone is
read again after `CONFIRM_AFTER_MS` and only recorded if it still disagrees.

### `deviceId`

A random id the install makes once and remembers — not a hardware id, not a
fingerprint, never used for auth. It exists because two devices in two zones
answer the zone question differently and the later answer is not automatically
the right one; that cannot be untangled after the fact, so every row carries its
source from the first write. `crypto.randomUUID` needs a secure context and
`docs/running.md` requires the simulator to load the dev server over the **LAN
address**, which is not one — so the fallback is reached in ordinary device
testing, not just in theory.

## Telling the user

A dialog, not `ui/modal/Modal` — that is a sheet or a page, both built to hold
a form, and this is one sentence and one button.

**A rendered `IonAlert` driven by `isOpen`, not an imperative present.** This
notice is raised from a background check rather than from a render or an event,
and that breaks the imperative routes — silently, which is the dangerous part:
the row is recorded and nothing appears on screen. `useIonAlert` ties the
overlay to the component instance and left the alert sitting in the DOM with
Ionic's `overlay-hidden` class. It looked fine in dev, where StrictMode's double
mount happened to leave a usable controller — the bug was invisible exactly
where it was being tested, so a production build is the only way to see it.

Two Ionic constraints decide the shape, and each was found by hitting it:

| | |
|---|---|
| `header` is taken as the element is created | A header that arrives later renders the message and the button under **no title at all**. So the notice is mounted fresh per zone, with `key`, already carrying its header. |
| It presents only on a false-to-true `isOpen` | Mounting it already open shows nothing, and so does flipping during the mount commit. It opens a beat later, from a `setTimeout`. |

`isOpen` being a boolean is also what makes the original bug impossible: three
dialogs stacked on one change came from an effect that re-presented on every
re-render, and the enqueue invalidates two queries, so there were plenty.

**Record first, then inform.** The observation is true at the instant it is
taken, so the row is written and the calendar moves with it; the dialog only
reports what already happened. There is deliberately nothing to accept or
refuse — refusing would assert the user is somewhere their own clock disagrees
with, which makes every rendering wrong. A genuinely misreported zone (VPN, auto
timezone off) waits for the zone picker.

It fires once per real change rather than once per launch, because recording
first means the timeline agrees with the device immediately.

Queued always, announced only with a token: logged out this runs on the login
screen, where "you're now in Tokyo Time" over the password field explains
nothing.

## Drawing it

Day headers carry the offset as a superscript; the grid carries bands where a
change leaves an hour dead or doubled. Both read the same merged timeline. See
[`calendar-layout.md`](calendar-layout.md) for the mobiscroll side — the bands
are `invalid`/`colors` entries, which are positioned by `_getEventPos` at
arbitrary times rather than snapped to cells.

## Recurrence, and why rules are never rewritten across zones

A rule is stored with the zone it was written in and always expanded in that
zone. Rewriting it into the reader's zone breaks in at least four ways that have
no fix: DST divergence between the two zones, `byDay` phase shifting when the
local time crosses midnight, monthly rules on the 31st, and yearly rules on
Dec 31.

## Known issues

| | |
|---|---|
| No way to correct a row in-app | The zone picker is not built yet, so a junk row is permanent. The confirm re-read is what stands in for it. |
| DST bands are not drawn | `getTimezoneOffsetOnDates` returns one offset per day, and a DST transition needs the **segments** within a day. Travel bands work because a change is a single instant. |
| Midnight re-render | Inherited: the now-line and the today badge stay on yesterday's column until something else re-renders. |
| Dialog dismissal is unverified in the Browser pane | `requestAnimationFrame` never fires there, and Ionic's enter/leave are animations, so `dismiss()` never completes and "Got it" appears stuck. It is an artifact of a pane that does not composite, not of the app — but it means the dismissal has to be confirmed in a real browser or on device. |
| A duplicate row is possible offline on a cold start | With an empty cache and no network the check has no timeline to compare against, so it records. The row is honest — the device did see that zone — and the timeline tolerates it. |
