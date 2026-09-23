# Events and the plan

How a project's rules become events on the grid, how an edited event survives a
change to the rule that made it, and how the same events fill the dispatcher's
PLAN section.

This is a **design document written before the work starts**, not a record of
something that ships. It exists so several agents can build parts of it without
each re-deriving the same decisions. Where a decision is still open it says so
in the text and repeats it in [§12](#12-open-decisions); an open item is a thing
to settle, not a thing to guess at.

**Partly superseded — read this first.** `D-003` and `D-007` have since been
decided and built, and they settle two of the open items below in a direction
this document argues against. Where the two disagree, the decisions win:

- **`TimeComponent` is now `RecurringTimeComponent`** and holds only a cadence.
  Its `type`, `absoluteFrom` and `absoluteTo` are gone, as is the
  `TimeComponentType` enum. §1, §3.1 and §4.1 still describe the old shape.
- **`Event` is the row behind every non-recurring entry**, standalone or
  exception, and `Event.recurringTimeComponentId` is nullable.
  `absoluteFrom`/`absoluteTo` are now `start`/`end`. Every field naming the old
  table was renamed with it: `Project.recurringTimeComponents`, the
  `recurringTimeComponentId` foreign keys, and the API's
  `created`/`updated`/`deletedRecurringTimeComponent…` lists. Passages below
  that quote the old names are describing the shape before this change. **This settles `D2` the opposite way** from §3.2(a)'s
  recommendation: the objection there — that ad-hoc events would flood the
  project form's list — does not apply, because the form already showed these
  entries as exact-time components and still does. Nothing about the UI changed.
- **`updateProject` is transactional** (`D-007`), so §3.2(d) is fixed.
- **`D5` (occurrence identity) is deliberately still open.** No `occurrenceDate`
  column was added and the existing unique key was left alone, because nothing
  creates an exception yet. The migration stays free until it does.
- §2.1's claim that "the `projectsVersion` optimistic-concurrency machinery in
  `api/project.ts` already works" is **wrong** — `api/project.ts` discards the
  version and nothing on the client reads it.

Read [`timezone.md`](timezone.md) first — it holds the rules this feature is not
allowed to break, and they are the reason several of the choices below look
roundabout. [`calendar-layout.md`](calendar-layout.md) holds the mobiscroll
constraints, and [`dispatcher.md`](dispatcher.md) the seams PLAN plugs into.

---

## 1. Vocabulary

The words below are used in exactly these senses for the rest of the document.
Several of them name things that do not exist yet.

| Term | What it is |
|---|---|
| **Project** | The `Project` row. Carries the target, `projectType`, `originalTimezone`, the hierarchy (`parentProjectId`), the dispatcher order (`position`) and the colour. |
| **Time component** | A `TimeComponent` row — a *rule* hanging off a project. `ABSOLUTE` (one span: `absoluteFrom`/`absoluteTo`) or `RECURRING` (a cadence plus one or more slots). |
| **Slot** | A `RecurringTimeSlots` row — the shape a recurring component takes *within* a day. `ABSOLUTE` (`from`/`to` clock times) or `FLEXIBLE` (`flexibleMinutesNeeded`, no placement). |
| **Occurrence** | One (slot, date) pair produced by expanding a cadence, or the single span of an `ABSOLUTE` component. **Virtual — it has no row and no id of its own.** |
| **Materialized event** | An `Event` row. Two jobs, and they must not be confused: an **exception** that overrides one occurrence, or a **standalone** event that no rule produces. |
| **Resolved event** | What the calendar and PLAN actually consume: an occurrence after exceptions have been applied and the zone resolved. Purely derived, never stored. |
| **dateFrame** | The user's selected date range. `DateRange` from `system/helpers/dateRange.ts`, **both ends inclusive**. Owned by `MainPage`, persisted through `layoutStorage`. |
| **timeFrame** | The hours of the day PLAN measures against. `['00:00:00', '24:00:00']` today, a `useState` constant in `MainPage`. Hardcoded *for now* — nothing may assume it stays 24 hours. |
| **Plan entry** | A `PlanEntry` row: a project the user has touched in PLAN over some range. Does not exist yet. |
| **Plan row** | One rendered line in the PLAN section. Derived. |

Two naming notes. The table is called `Event`, not `MaterializedEvent`; renaming
it is not worth a migration, so prose says "materialized event" and code says
`Event`. And "materializing the plan" and "materializing an event" are different
operations on different tables that happen to share a verb — §7 and §9.

---

## 2. The pipeline, end to end

```
GET /project                GET /event?from&to           GET /timezone-change
(whole snapshot,            (range-filtered,              (zone timeline,
 projectsVersion)            does not exist yet)           already built)
      │                            │                             │
      └──────────────┬─────────────┴─────────────────────────────┘
                     ▼
          resolveEvents(projects, events, dateFrame, timezoneHistory)
            1  drop components whose own span misses the widened frame
            2  expand RECURRING → occurrences, in project.originalTimezone
            3  ABSOLUTE component → one occurrence
            4  index materialized events by occurrence key
            5  apply exceptions; append standalone events
            6  resolve wall clock → viewer's zone (EXTERNAL only)
            7  clip to the real frame
                     ▼
              ResolvedEvent[]
                 ├──────────────────────────► Calendar   (mobiscroll, §6)
                 │
                 └──► buildPlan(resolved, planEntries, projects, timeFrame)
                             ▼
                        PlanRow[]  ──────────► PLAN section (§7)
```

Three properties of this shape are worth stating because they are what keep it
tractable:

**One resolver, two readers.** The calendar and PLAN never compute events
separately. If they did, a rule for which one of them applies an exception and
the other does not is a bug nobody can see from either side.

**The resolver is pure.** `(projects, events, dateFrame, timezoneHistory) →
ResolvedEvent[]`, no fetching, no hooks, no `Temporal.Now`. That is what makes
the cadence rules testable, and they are the part most likely to be wrong.

**Nothing derived is stored.** A resolved event is recomputed every time the
frame changes. `Event` rows and `PlanEntry` rows hold only what cannot be
derived — the user's deviations from what the rules say.

### 2.1 Where the fetching happens

Decided: **projects whole, events range-filtered.**

- `GET /project` stays exactly as it is. The dispatcher needs every project for
  ACTIVE and BACKLOG anyway, the `projectsVersion` optimistic-concurrency
  machinery in `api/project.ts` already works, and narrowing it would break the
  single cache that DnD's `applyMove` writes into.
- `GET /event?from&to` is **new**. It returns the materialized events that
  intersect the frame, keyed in react-query as `['events', from, to]`.
- Cadence expansion stays **client-side**. `timezone.md` is explicit that a rule
  is expanded in the zone it was written in, and the client is where the viewer's
  zone timeline lives. The backend has no reason to know about the viewer at all.

Prerequisite, and it is not optional: `GET /event` currently returns
`Prisma.PrismaPromiseArray__type` in the SDK, which is the `PrismaPromise`
failure mode `CLAUDE.md` documents at length. The service must `await` the
repository call before the generated client is usable. `CreateEventDto` and
`UpdateEventDto` are both `{}` and every write handler on `EventsController` is
an empty stub, so the entire event write path is greenfield.

---

## 3. Data model

### 3.1 What exists

Verbatim from `backend/src/system/database/schema.prisma` on `events-display`,
trimmed to what matters here:

```prisma
model TimeComponent {
  id   String            @id @default(uuid())
  type TimeComponentType                      // ABSOLUTE | RECURRING

  absoluteFrom DateTime? @db.Timestamp(0)
  absoluteTo   DateTime? @db.Timestamp(0)

  recurringInterval   Int?
  recurringFrequency  RecurringFrequency?     // DAY | WEEK | MONTH | YEAR
  recurringByDay      WEEKDAY[]
  recurringByMonthDay Int?
  recurringByMonth    Int?

  firstRecurringEventAt DateTime? @db.Timestamp(0)
  lastRecurringEventAt  DateTime? @db.Timestamp(0)

  project            Project              @relation(...)
  projectId          String
  recurringTimeSlots RecurringTimeSlots[]
  events             Event[]
}

model RecurringTimeSlots {
  id                    String                 @id @default(uuid())
  type                  RecurringTimeSlotsType // ABSOLUTE | FLEXIBLE
  from                  DateTime?              @db.Time(0)
  to                    DateTime?              @db.Time(0)
  flexibleMinutesNeeded Int?
  timeComponentId       String
  events                Event[]
}

model Event {
  id               String  @id @default(uuid())
  overridedName    String?
  overridedGoal    String?
  overridedContext String?

  absoluteFrom             DateTime? @db.Timestamp(0)
  absoluteTo               DateTime? @db.Timestamp(0)
  recurringOccurrenceIndex Int?

  projectId            String
  timeComponentId      String          // NOT NULL
  recurringTimeSlotsId String?

  @@unique([recurringTimeSlotsId, recurringOccurrenceIndex])
}
```

**Every temporal column in this database is a wall clock.** There is no
`timestamptz` anywhere. `@db.Timestamp(0)`, `@db.Date`, `@db.Time(0)` — all
second precision, all zone-free, all round-tripped through
`Date.UTC(...)` in `backend/src/system/common/date.mappers.ts` so the driver
writes the fields back out unchanged. The wire type `DateTimeString` has a
pattern that **forbids a trailing `Z`**, so an instant cannot be sent by
accident. None of this may change.

The `Event` table is **defined and entirely unpopulated** — nothing anywhere
writes a row. That is a gift: every schema decision below is free right now and
expensive in a month.

### 3.2 Four problems with `Event` as it stands

**(a) `timeComponentId` is NOT NULL, so a standalone event has nothing to point
at.** An event the user creates by dragging on an empty cell, for a project with
no rule, has no component.

The clean answer is to **not have standalone events at all**: an event with no
rule behind it *is* an `ABSOLUTE` time component. Creating one on the calendar
writes a `TimeComponent` with `type: ABSOLUTE`, `absoluteFrom`, `absoluteTo`, and
nothing else. The `Event` table is then reserved for exactly one thing —
**exceptions to recurring occurrences** — and `timeComponentId` /
`recurringTimeSlotsId` are both always populated, which makes the unique
constraint meaningful (Postgres treats `NULL`s as distinct, so `(NULL, NULL)`
rows are unconstrained today).

The cost is that every ad-hoc calendar event becomes a row in the list the
project form renders in `TimeComponentsBlock`. For a project with twenty dragged
events that list is unusable. **Open** — see [D2](#d2-do-standalone-events-exist).

**(b) The occurrence key is fragile.** See §5.

**(c) Deleting a time component hard-deletes its events.**
`TimeComponentsRepository.deleteTimeComponent` runs
`$transaction([event.deleteMany({timeComponentId}), recurringTimeSlots.deleteMany(...), timeComponent.delete()])`.
So removing a cadence in the project form silently destroys every exception the
user made to it, with no warning and no undo. `modals.md` already lists this;
it stops being theoretical the moment exceptions exist.

**(d) `ProjectsService.updateProject` is not transactional.** It deletes,
updates and creates time components and then bumps `projectsVersion` across
several separate awaits. `moveProject` does use a transaction and an advisory
lock; `updateProject` should match before it starts carrying exception
invalidation too.

### 3.3 What gets added

```prisma
model Event {
  // identity of the occurrence this overrides — see §5
  occurrenceDate DateTime? @db.Date          // NEW
  // recurringOccurrenceIndex kept as a derived convenience, not as identity

  @@unique([recurringTimeSlotsId, occurrenceDate])   // REPLACES the index constraint
}

model PlanEntry {                             // NEW — see §7
  id        String   @id @default(uuid())
  user      User     @relation(...)
  userId    String
  project   Project  @relation(...)
  projectId String

  planFrom  DateTime @db.Date                // inclusive
  planTo    DateTime @db.Date                // inclusive
  planPosition String                        // fractional index, own key space

  timeNeededMinutes Int?                     // per-frame target
  minBlockMinutes   Int?
  repetitionsNeeded Int?

  isPinned  Boolean  @default(false)
  isExcluded Boolean @default(false)         // "remove from plan" — see §7.5

  updatedAt DateTime @updatedAt              // overlap tie-break — see D5

  @@index([userId, planFrom, planTo])
  @@unique([userId, projectId, planFrom, planTo])
}
```

`planPosition` is a `fractional-indexing` key in its **own key space**, unrelated
to `Project.position`. Like `Project.position` it must be `TEXT COLLATE "C"` so
Postgres agrees with the client's lexicographic comparisons — the existing
migration `20260903100000_project_position` is the template.

---

## 4. Expanding a cadence

This is the part with the most edge cases and the least existing code. Nothing
expands a cadence today; `spread.projects.to.events.ts` filters
`type === 'ABSOLUTE'` and drops recurring components in both its branches.

**Expansion happens in `project.originalTimezone`, always.** `timezone.md` gives
four reasons a rule may never be rewritten into the reader's zone — DST
divergence, `byDay` phase shifting when the local time crosses midnight, monthly
rules on the 31st, yearly rules on Dec 31 — and calls them unfixable. The zone
conversion is a separate, later step (§6.1) applied to already-expanded
occurrences.

### 4.1 The cadence rules

Derived from `TimeComponentFields.__validate`, which is the only place the
grammar is currently written down:

| Frequency | Required | Expands to |
|---|---|---|
| `DAY` | `recurringInterval` | Every `interval` days from `firstRecurringEventAt`. |
| `WEEK` | `interval`, `recurringByDay` | Every `interval` weeks, on each weekday listed. Phase anchored on the week containing `firstRecurringEventAt`. |
| `MONTH` | `interval`, `recurringByMonthDay` | Every `interval` months, on that day of month. |
| `YEAR` | `interval`, `recurringByMonthDay`, `recurringByMonth` | Every `interval` years, on that month and day. |

`firstRecurringEventAt` is required for every recurring component;
`lastRecurringEventAt` is optional and absent means unbounded. Both are stored as
`<date>T00:00` wall clock and the editor re-stamps midnight on save, so anything
non-midnight written by other means is rounded down by the next edit.

### 4.2 Edge cases that must be decided before anything is written

| # | Case | What it should do |
|---|---|---|
| 1 | **Month day 31 in a 30-day month; Feb 29** | **Skip** — an occurrence on a date that does not exist does not happen. This matches RFC 5545 `BYMONTHDAY`. ⚠️ `Temporal.PlainDate.from({...})` defaults to `overflow: 'constrain'`, which silently clamps to the 30th. Pass `{ overflow: 'reject' }` and catch, or the wrong behaviour ships by default. |
| 2 | **`YEAR` on Feb 29** | Same rule: three years in four produce nothing. |
| 3 | **`WEEK` with `interval > 1`** | The counting week is the ISO week containing `firstRecurringEventAt`, with `WEEK_STARTS_ON = 1` (Monday) from `config/calendarPreferences.ts`. This was the open question the `firstRecurringEventAt` work closed — do not reopen it by anchoring on something else. |
| 4 | **`byDay` days earlier in the anchor week than `firstRecurringEventAt`** | First = Wednesday, `byDay = [MO, FR]`: Monday of that week produces **nothing**. `firstRecurringEventAt` is a floor on occurrences, not only a phase anchor. |
| 5 | **What `lastRecurringEventAt` bounds** | The occurrence **start date**, inclusive. An occurrence starting on the last date is kept even if its slot runs past midnight. |
| 6 | **Several slots on one component** | Each slot expands independently. Three slots on a daily cadence give three occurrences per day. This is why the occurrence key is per-slot and not per-component. |
| 7 | **A slot that wraps midnight** | `slotWrapsMidnight` already exists in `timeComponentsState.ts`. An occurrence starting on day D ends on D+1, so the pre-filter in step 1 must widen the frame before deciding a component is irrelevant — otherwise the first day of a frame loses the occurrence that began the night before. |
| 8 | **DST inside the project's own zone** | A 02:30 occurrence on a spring-forward day does not exist. `toZonedDateTime` defaults to `disambiguation: 'compatible'`, which pushes forward. Pass it explicitly rather than inheriting it, so the choice is visible. `timezone.md` already records that DST bands are **not drawn** on the grid, so this shift will be silent to the user. |
| 9 | **Unbounded cadence, distant frame** | Compute the first occurrence at or after `frameStart` **arithmetically** — modular for `DAY`/`WEEK`, a month-count division for `MONTH`/`YEAR`. Iterating from `firstRecurringEventAt` is O(years) and will be the first performance bug in this feature. |
| 10 | **`FLEXIBLE` slots** | They have no `from`/`to`, only `flexibleMinutesNeeded`, so they **cannot be placed on the grid and produce no calendar event**. They are demand without a placement. See [D6](#d6-what-flexible-slots-mean-to-the-plan) for what they mean to PLAN. |
| 11 | **`interval` of 0 or negative** | The DTO enforces `>= 1` on the client (`isDraftValid`) but the backend only checks presence. Guard in the expander anyway — an interval of 0 is an infinite loop, not a validation error. |
| 12 | **A component whose span misses the frame entirely** | Skipped before any expansion. This is the cheap pre-filter and the only thing keeping a ten-year-old daily cadence affordable. |

### 4.3 The frame is widened before expansion and clipped after

Two separate reasons to widen, and they compound:

- A midnight-wrapping slot (case 7) moves an occurrence's *end* into the next day.
- The zone conversion in §6.1 can move an occurrence by up to **26 hours** —
  UTC+14 to UTC−12 — before it lands on the grid.

So: expand over `[frameStart − 1 day, frameEnd + 1 day]`, convert, **then** clip
to the real frame. The current `spread.projects.to.events.ts` clips after
conversion for `EXTERNAL`, which is right, but there is no widening to go with it
because there is nothing recurring to widen yet.

**The frame comparison should be half-open.** The current code builds
`[start.toPlainDateTime('00:00:00'), end.toPlainDateTime('23:59:59')]`, which
excludes the last second of the last day and keeps an event that ends exactly at
`frameStart` — rendering a zero-height sliver on the first column. Use
`[start T00:00, (end + 1 day) T00:00)` with `end > frameStart && start < frameEnd`.

---

## 5. Occurrence identity — how an exception finds its occurrence

An exception is a row that says "this occurrence, but different". The whole
design turns on what "this occurrence" means, because whatever is chosen has to
survive the user later editing the rule.

Three candidates, and the current schema has picked the fragile one.

### Option A — occurrence index from the anchor (what the schema has today)

`@@unique([recurringTimeSlotsId, recurringOccurrenceIndex])`, where the index is
the Nth occurrence counted from `firstRecurringEventAt`.

- **For:** compact. The index falls out of the arithmetic §4.2 case 9 requires
  anyway. The constraint already exists.
- **Against, fatally:** every cadence edit renumbers. Change `interval` from 1 to
  2 and every existing exception points at a different date. Move
  `firstRecurringEventAt` and everything shifts. Add a weekday to `byDay` and the
  numbering interleaves. And `updateTimeComponent` does a **full scalar replace**
  on every save, so this is reachable from an ordinary trip through the project
  form. It corrupts silently — nothing errors, the user's moved events simply
  land on the wrong days.

### Option B — the occurrence's own date (recommended)

`@@unique([recurringTimeSlotsId, occurrenceDate])`, where `occurrenceDate` is a
`@db.Date` holding the date the occurrence starts **in the project's own zone**.

- **For:** survives every cadence edit that does not move that particular day.
  Change the interval, add a weekday, move the first date — an exception on
  2026-06-19 is still an exception on 2026-06-19. Readable in the database, which
  matters for a table nobody can inspect through the UI.
- **For:** keying on the *date* rather than the full wall clock means editing a
  slot's `from` time does not orphan its exceptions. A slot produces at most one
  occurrence per date, so the date is enough.
- **Against:** an exception can be orphaned — the user changes `byDay` from `FR`
  to `TH` and the Friday exception has no occurrence to attach to. That needs a
  policy, and "silently delete it" is the wrong one: the user deliberately moved
  that event. See [D3](#d3-what-happens-to-an-orphaned-exception).

### Option C — both, date as identity and index as a derived column

Robust identity plus a cheap ordinal for debugging and display.

- **Against:** two columns that can disagree, and a rule nobody remembers about
  which wins. Not worth it unless something needs the ordinal, and nothing does.

**Recommendation: B.** The migration is free today because the table is empty,
and it stops being free the moment anything writes to it. `recurringOccurrenceIndex`
can be dropped outright or kept nullable and unconstrained for debugging; it must
not be part of any unique key.

---

## 6. The calendar

### 6.1 Resolving a wall clock into the viewer's zone

The rule, from `timezone.md`, and it is `projectType`'s question rather than the
component's:

- **`INTERNAL`** — the user chose the hour themselves, so the stored wall clock
  *is* the answer. Identity function, both directions. Going to the gym.
- **`EXTERNAL`** — something outside the user fixed the hour, so the wall clock is
  read against `project.originalTimezone` and re-expressed in the zone the user
  was in at that instant. A gym class.

Display, as `spread.projects.to.events.ts` already does it:

```
stored wall clock
  → .toZonedDateTime(project.originalTimezone)
  → .toInstant()
  → getTimezoneAtMoment(history, instant)        // the viewer's zone then
  → .withTimeZone(thatZone).toPlainDateTime()    // what the grid draws
```

Two things about this are deliberate and currently undocumented in the code:

- **The zone is sampled once, at the occurrence's start instant, and the end is
  converted with that same zone.** An event spanning a recorded travel change is
  therefore drawn whole in the zone the user was in when it began, rather than
  being split or stretched. That is the right call — a two-hour meeting should
  look two hours long — but it means the end's wall clock is not what that
  instant reads in the zone the user is actually in by then.
- **`getTimezoneAtMoment` is the non-strict variant**, falling back to
  `deviceZone()` on an empty timeline. That is correct for a renderer and wrong
  for the watch; `timezone.md` explains why, and `recordDeviceZone.ts` uses the
  strict one. Do not "fix" the renderer to match.

### 6.2 Saving an edit back — and the circularity that will bite

The save path is the inverse:

```
new wall clock from the grid
  → .toZonedDateTime(viewerZone)
  → .toInstant()
  → .withTimeZone(project.originalTimezone).toPlainDateTime()   // what to store
```

**`viewerZone` must be the zone that was used for display, not one re-derived
from the new time.** The lookup needs an instant and the instant needs a zone, so
re-deriving is circular; resolving it by sampling at the *new* time means
dragging an event across a recorded travel boundary makes it jump somewhere the
user did not drop it. Carry the display zone on the `ResolvedEvent` and use it
verbatim on save. This is the single subtlest thing in the feature and it will
not show up in any test written in one zone.

**Moving an `EXTERNAL` event does not change `originalTimezone`.** The rule was
written in that zone; moving one occurrence is an exception to it, not a rewrite
of it. A user in Tokyo who drags a Kyiv-scheduled class from 17:00 to 18:00 Tokyo
time has stored 11:00 Kyiv, and that is correct.

**`INTERNAL` projects behave as they do today and always have.** `modals.md`
records that every project currently behaves as `INTERNAL` whatever its type
says, because the zone-aware read path does not exist. This feature is where that
stops being true — which means shipping it changes the rendering of existing
`EXTERNAL` projects for anyone whose timeline has a zone change in it.

### 6.3 What a resolved event must carry onto the grid

Today `Calendar.tsx` maps the spread output to `{ title, start, end }` and
nothing else. That is not enough for anything interactive: there is no `id`, no
colour, and the `project` reference is dropped, so a click cannot be traced back
to what was clicked.

Mobiscroll keeps arbitrary custom properties on an event object and hands them
back in every handler argument. That is the sanctioned route:

```ts
type ResolvedEvent = {
  start: Temporal.PlainDateTime;        // already in the viewer's zone
  end: Temporal.PlainDateTime;
  displayZone: string;                  // §6.2 — the zone used for display
  project: ProjectWithTimeSlots;
  timeComponentId: string;
  slotId: string | null;                // null for an ABSOLUTE component
  occurrenceDate: Temporal.PlainDate;   // §5 — identity
  eventId: string | null;               // the Event row, when one exists
  origin: 'rule' | 'exception' | 'standalone';
  isEditable: boolean;
};
```

and the mobiscroll shape:

```ts
{
  id,                                   // stable across renders — see below
  title, start, end,
  color: project.color?.hexCode ?? inheritedColorHex,
  editable, resize, dragInTime,
  ...identity fields as custom props
}
```

**The id has to be stable across renders**, because react-query refetches produce
new objects and mobiscroll uses the id for its own layout bookkeeping. Derive it
from the identity — `${timeComponentId}:${slotId ?? '-'}:${occurrenceDate}` — not
from array position.

**Colour needs the inheritance walk.** `project.color` is often null and the
dispatcher resolves it by walking ancestors in `buildSectionRows`. That walk is
currently per-section and per-category, and it explicitly does not inherit across
categories. The calendar needs the same colour, so the walk has to be lifted out
of `projectTree.ts` into something both can call — see
[D7](#d7-colour-inheritance-for-events).

### 6.4 Mobiscroll settings, and what is not negotiable

`calendar-layout.md` establishes that **nothing which varies per page may enter
the `view` object** — the trial build does a JSONP round-trip to
`trial.mobiscroll.com` on any `view` change, measured at **1208 ms**. `dragTimeStep`
is on that list along with `firstDay`, `zoomLevel` and `resources`.

| Setting | Value | Why |
|---|---|---|
| `dragTimeStep` | a module constant, 15 | On the round-trip list. A "snap finer when zoomed in" design is off the table for the same reason `timeCellStep` is fixed at 60 forever. |
| `immutableData` | `true` | `preparedEvents` is a fresh array literal per render across N instances, and react-query owns the truth. Letting mobiscroll mutate `data` directly is the wrong default here. |
| `dragToMove` / `dragToResize` | `true` globally | Gate per event with `editable` / `resize` / `dragInTime`, which take precedence over the globals. `FLEXIBLE` slots get `editable: false`. |
| `eventDelete` | `false`, **explicitly** | Enabling `dragToCreate` or `clickToCreate` silently enables Delete/Backspace deletion unless this is set. |
| `clickToCreate` | not used | Desktop-only by documentation. Tap-an-empty-cell-to-create must be built on `onCellClick`. |
| `invalidateEvent` | `'start-end'` | The default `'strict'` forbids an event from *intersecting* a dead timezone band at all, which rejects legitimate drags near a travel boundary. Explain the rejection through `onEventUpdateFailed`, which carries the offending `invalid` object. |

The handler chain is `onEventUpdate` (cancellable, return `false`) →
`onEventUpdated` (persist here) → `onEventUpdateFailed` (explain). `onEventDragStart`
carries `action: 'create' | 'resize' | 'move'`, which is how move is told from
resize.

### 6.5 Calendar edge cases

| # | Case | Note |
|---|---|---|
| 1 | **Cross-row drag is impossible** | There is one `Eventcalendar` instance *per row of days*. Dragging from the last day of row 1 to the first day of row 2 crosses two separate instances. Only `externalDrag`/`externalDrop` could bridge them, and that is a different gesture path. Either accept it and require the event form for cross-row moves, or budget for the external-drop work. |
| 2 | **Every handler is bound N times** | One per row instance. Each must resolve which row fired it. There is no single instance to hold selection, so `selectedEvents` would have to be mirrored across all of them. |
| 3 | **Gesture contention** | `useCalendarSwipe` is registered *before* `useCalendarZoom` deliberately — that ordering is what makes "a second finger abandons the swipe" and "only zoom may unlock a pinch" work. Mobiscroll's own drag is a **third** consumer of `touchmove` on the same subtree, and on touch it starts with a long press, which is also how the dispatcher's DnD starts. Slot it into the existing order deliberately; do not bypass `setScrollLocked`. |
| 4 | **No windowing** | `virtualScroll: false` — every event in the frame is in the DOM. A 31-day frame across many recurring projects is the scaling risk, and `calendar-layout.md` is blunt that "anything that multiplies the DOM is unaffordable while zoom stays layout-driven" (~41 ms per zoom frame at 21 rows). |
| 5 | **Dead bands block moves, not renders** | Events sit at `z-index: 2` specifically so an event inside a dead band stays visible. `invalidateEvent` will still refuse to *move* one. These are two different mechanisms and fixing one does not fix the other. |
| 6 | **Reading a `Date` back from mobiscroll** | `fromDateToPlainDateTime` **does not exist** in `dateConversions.ts` — only the forward direction. And `fromPlainDateTimeToDate` drops milliseconds, so a round-trip is lossy below the second. Add the inverse with the local-fields constructor to match. |
| 7 | **Test data still ships** | `testEvents` are concatenated ahead of real events in `preparedEvents`, and `DEFAULT_RANGE` is hardcoded to their August 2026 span. Both have to go before this is demoable. |
| 8 | **Trial watermark** | Events render a TRIAL watermark. Any visual work on event chips is being judged through it. |
| 9 | **Resizing below zero** | A resize that drags the end before the start, or a move onto a DST-skipped hour. Reject in `onEventUpdate` rather than storing and hoping. |
| 10 | **An exception dragged back onto its original slot** | Should the `Event` row be deleted, so the occurrence returns to being rule-driven? Tidier, and it stops the table filling with no-op exceptions. Needs an exact-match comparison against the recomputed occurrence. |

### 6.6 Editing scope

Decided: **this occurrence only.** Every calendar edit materializes exactly one
exception. No dialog, no "this and following", no "all events".

"This and following" means splitting a `TimeComponent` in two — bounding the
original with `lastRecurringEventAt` and creating a successor — and then deciding
what happens to exceptions on either side of the split. That is a feature of its
own and it is explicitly deferred. Note that `lastRecurringEventAt` already
exists precisely because it will be needed for it.

**Deleting an occurrence is a separate gap.** There is no cancellation column on
`Event`, so an occurrence cannot currently be skipped without editing the rule.
This will be asked for early — see [D4](#d4-cancelling-a-single-occurrence).

---

## 7. The PLAN section

PLAN is a third project list in the dispatcher, alongside ACTIVE PROJECTS and
BACKLOG. Today it is a `DispatcherSection` with a title, an expand state, an
`onAdd` that is `() => {}` and **no children at all** — it renders nothing.
`dispatcher.md` says so plainly: *"PLAN has no swipe because it has no data."*

### 7.1 Membership

A project is in PLAN for a frame if either:

- **indirectly** — at least one resolved event in the frame belongs to it, or
- **directly** — a `PlanEntry` intersecting the frame exists for it.

Ancestors are then pulled in as **containers** so the tree can render, but a
container is not a member: it carries no indicators, no target and no error.

### 7.2 Container collapsing

The rule, stated precisely:

> A node **N** collapses into its child **C** when (a) N is a container only — not
> directly planned, and has no resolved event of its own in the frame — and (b) N
> has **exactly one child rendered in PLAN**. C is then drawn at N's depth, named
> `N / C`.

Applied repeatedly, so a chain A → B → C with only C planned collapses to a
single row named `A / B / C` at depth 0.

| # | Case | Answer |
|---|---|---|
| 1 | Does "exactly one child" count children in PLAN or overall? | **In PLAN.** A project with five children of which one is planned collapses. PLAN is a subset view and the rule is about what is drawn. |
| 2 | Recursive chains | Yes — apply from the root downward until no node qualifies. |
| 3 | The breadcrumb at 360 px | Reuse `ui/breadcrumbs/`, which `ProjectForm` already drives from `ancestorsOf`. It has to ellipsise, and the **last** segment is the one that must survive. |
| 4 | Indicators on a collapsed chain | Belong to C, the member. A container has nothing to indicate. |
| 5 | The container becomes planned later | The chain un-collapses on the next build. But the row's identity changes — the DnD id was C's and is now B's, with C as a child. The reveal/stagger machinery (`RevealRequest`, `revealStagger`) keys off project id, so this needs checking rather than assuming. |
| 6 | Dragging a collapsed row | The dragged entity is **C**, not the chain. |
| 7 | Two children, one of them a container that collapses to one member | N has two children rendered, so N does **not** collapse, even though only one member is underneath. The rule is about rendered children, deliberately — it keeps the collapse decision local and cheap. |

### 7.3 Ordering

PLAN reuses the project tree shape — it should read like ALL PROJECTS — with
siblings ordered by `planPosition` when present and by the project's own
`position` when not.

The awkward part is the first drag. Fractional indexing needs keys on both sides
of an insertion point, and an indirectly-planned sibling has no `planPosition`.
**On the first reorder within a sibling group, materialize `planPosition` for
every sibling in that group in one write.** `project.drag.service.ts` already
does exactly this shape of bulk key generation in `rebalance` via
`generateNKeysBetween`, under a per-user advisory lock; follow it.

PLAN reordering needs its own lock key — `plan-chain:<userId>` — for the same
reason the project chain has one.

### 7.4 The row

`ProjectRow.tsx` already has the shape: colour strip | chevron slot | a name
block with **two lines** | ⋮ menu. The second line,
`<span className="project-row-meta" aria-hidden="true" />`, is reserved and
**empty**. Filling it is most of the visible work.

Line 1 — the name, or the collapsed breadcrumb.

Line 2 — time metadata, whichever applies:

| Situation | Renders | Serializer |
|---|---|---|
| Directly planned with a target | `Scheduled: 8:00` + a target chip `9h 30m` | `serializeDuration` |
| One dated occurrence in the frame | `Wed 04/19 · 10:00 – 10:20` | `serializeDate` + `serializeTimeRange` |
| A cadence | `Every Tu, Th, Fr` | `serializeTimeComponent` already produces `Every Friday · 9–11 AM · until Dec 1` |

All three serializers exist in `system/helpers/dateTimeSerializers.ts` and
`modals/components/timeComponents/serializeTimeComponent.ts`. The metadata
requirements are **not finalised**; what is settled is that it carries basic
cadence information, and a concrete date for anything scheduled on one.

Indicators and controls: an **error** indicator (§7.6), a **pinned** indicator,
and **play / stop** with a running elapsed time.

> ⚠️ **Play/stop has nothing behind it.** There is no timer, session, or
> time-entry model anywhere in the schema, and no endpoint. The running `29:31`
> in the mock is a whole feature — a `TimeEntry` table, a start/stop API, a
> single-running-timer invariant, offline behaviour, and what happens when the
> app is killed mid-session. It should be its own document and its own work.
> See [D8](#d8-is-playstop-in-scope).

### 7.5 What materializes a plan

Any direct interaction writes a `PlanEntry` for **exactly the frame currently
selected**. Existing entries are never split or extended.

- "Add to Plan" from the ⋮ menu or the section's `+`.
- A reorder within PLAN (which also backfills siblings, §7.3).
- Setting a per-frame target.
- Pinning.
- Removing a project from PLAN → `isExcluded: true`, **not** a delete. An
  indirectly-planned project has events that still exist; without a tombstone
  "remove from plan" would silently do nothing and the row would come straight
  back. Excluding is the only way to say "not this week".

The per-frame target reuses `TargetDraft`'s shape and its normalisation —
`targetState.ts` already enforces that time and repetitions are mutually
exclusive, that time wins when the backend sends both, and that a minimum block
can never outlast the total it divides. Do not write a second set of those rules.

### 7.6 The error

A planned project is in error when the work scheduled inside the frame does not
cover its target for that frame.

| # | Question | Answer |
|---|---|---|
| 1 | Whose events count — the project's, or the subtree's? | **The subtree.** `modals.md` records that an event's target block is a read-only summary of its *ancestors'* targets, so targets flow down; a parent's target is satisfied by its children's work. |
| 2 | An event partly outside the `timeFrame` | Count the **overlapping minutes only**. With `timeFrame` at `['00:00:00','24:00:00']` nothing is excluded today, so this is invisible until the working-hours window becomes real — which is exactly why it has to be decided now. |
| 3 | Repetitions | Count events whose **start** falls inside the frame and the timeFrame. |
| 4 | A project with a target and no events | In error, and stays in PLAN — it was directly planned. This is the intended state, not a bug. |
| 5 | A project with events and no target | No error. Nothing to fall short of. |
| 6 | `FLEXIBLE` slots | See [D6](#d6-what-flexible-slots-mean-to-the-plan). |
| 7 | Where the error is shown | On the member row. A container in a collapsed chain shows the member's error because the member *is* that row. |

### 7.7 Reconciliation — and why it is free

The question raised in the brief was whether a materialized plan is patched at
read time with events altered since, or whether altering an event eagerly updates
every plan relying on it.

**With per-project entries over a range, neither is needed.** PLAN is rebuilt
from `ResolvedEvent[]` + `PlanEntry[]` on every frame change. Entries hold only
what cannot be derived — order, target, pinned, excluded. Moving an event out of
the frame simply changes membership next time the frame is built; there is
nothing stored to go stale and nothing to invalidate.

The only thing that can linger is a `planPosition` for a project that no longer
has events in the frame and is not directly planned. It is not rendered, and it
is correct if the project comes back.

This is the main argument for the model that was chosen over a whole-plan
snapshot, and it is worth not giving up quietly.

### 7.8 PLAN plugs into three existing seams

**The swipe.** `dispatcher.md` states the seam explicitly: *"`useProjectSwipe`
takes a label, an icon and `onCommit(id)`, and nothing else about meaning…
That seam exists for PLAN. A section over a different shape of data picks the
gesture up by rendering the same card and supplying its own action and its own
`rowsLeavingWith`. Nothing in the gesture mentions `ProjectStatus`, categories or
moving."* Adding PLAN's swipe is an entry in `projectSwipe.ts`, not new gesture
code.

**The section grid.** ⚠️ `useSectionResize` requires **exactly three**
`.dispatcher-section` nodes under its ref. PLAN already is one of the three — it
just has no body. Giving it a body must not add or remove a section node.

**The modal mount pattern.** From `Dispatcher.tsx`: conditional mount (not a
permanently-mounted modal toggled by `isOpen`), `isOpen` as a bare literal, `key`
= the entity id so opening a different one remounts and reseeds the form, and
`onDismiss` unmounts by nulling state. An `EventModal` opened from the calendar
follows this exactly, with the state lifted to `MainPage` — which already owns
`dateFrame` and both data sources and sits above the Calendar/Dispatcher split.

---

## 8. The event form

`EventForm` mirrors `ProjectForm` in structure but not in content. `modals.md`
is specific about the difference and it is worth quoting, because merging them is
the obvious mistake:

> an **event's target block is a read-only summary of its ancestors' targets**,
> sharing no state, no validation and no payload with `TargetComponent`, and its
> time editor is **one absolute row** rather than a list. Merging those would mean
> a `readOnly` prop that keeps a whole state machine alive behind two lines of text.

So `EventForm` is:

- Breadcrumbs of the project's ancestors, as `ProjectForm` renders them.
- The overrides the `Event` row already has columns for — `overridedName`,
  `overridedGoal`, `overridedContext`. An empty override means "inherit from the
  project", which is why they are nullable rather than copied on create.
- **One** absolute time row — start and end — not a `TimeComponentsBlock`.
- A read-only summary of the inherited target.

It reuses `useEntityForm` verbatim: one `reports` array, dirty meaning "differs
from what we opened with", a save that latches rather than re-baselining, and a
baseline captured once — which is why the `key` on the mount matters.

---

## 9. Flows

### 9.1 Opening a frame

1. `MainPage` owns `dateFrame`; the header's range picker and paging both move it.
2. `useProjectsQuery()` (whole snapshot) and the new `useEventsQuery(dateFrame)`
   resolve; `useTimezone()` supplies `history`.
3. `resolveEvents(...)` runs — **memoized on `[projects, events, dateFrame, history]`**.
   It is currently called unmemoized on every `MainPage` render, which returns a
   fresh array identity every time and will thrash mobiscroll once `data` matters.
4. The calendar draws; `buildPlan(...)` fills PLAN.

### 9.2 Dragging an event on the grid

1. `onEventDragStart` gives `action: 'move' | 'resize'`.
2. `onEventUpdate` validates — end after start, not into a dead band — and returns
   `false` to cancel if not.
3. `onEventUpdated` reads the identity custom props off the event object, converts
   the new `Date`s back to `PlainDateTime`, converts to the storage zone using the
   **display zone carried on the event** (§6.2), and issues the mutation.
4. The mutation is an upsert on `(recurringTimeSlotsId, occurrenceDate)` for a
   rule-derived event, or a plain update for one that already has an `eventId`.
5. Optimistic update follows `api/project.ts`: `cancelQueries` first — *"or a
   fetch already in flight lands afterwards and undoes the write"* — snapshot,
   `setQueryData`, roll back on error.

### 9.3 Adding a project to PLAN directly

1. ⋮ → "Add to Plan", or the PLAN section's `+`.
2. Write a `PlanEntry` for the current frame with a `planPosition` appended at the
   end of its sibling group, backfilling siblings if this is the group's first.
3. The project appears in PLAN with no events and, once a target is set, an error.
4. The user schedules events against it until the error clears.

### 9.4 Reordering in PLAN

1. Long-press drag inside the PLAN list, through the existing `ProjectDragProvider`.
2. `dropProjection` computes the landing spot; `applyMove` writes optimistically.
3. **Reparenting in PLAN is disabled** — dragging only reorders siblings. The PLAN
   tree shape is *derived from the frame*, so letting a drag restructure it would
   mean a gesture in a week-long view silently editing `parentProjectId` for
   every other view too. See [D9](#d9-can-plan-dnd-reparent).

---

## 10. Invariants — do not break these

Each of these is written down somewhere already and each has cost time at least
once.

1. **A recurrence rule is never rewritten into the reader's zone.** Store with
   `originalTimezone`, expand in it, convert only the expanded occurrence.
   (`timezone.md`)
2. **A `DateTimeString` on the wire carries no `Z`.** The typia pattern rejects
   it at the boundary; do not work around it.
3. **Nothing that varies per page enters the mobiscroll `view` object.**
   `dragTimeStep` is on that list. (`calendar-layout.md`)
4. **`timeCellStep` and `timeLabelStep` are fixed at 60 forever.**
5. **`canonicalZone()` both sides of any zone comparison.** Comparing a canonical
   device zone to a raw stored one appends a duplicate row on every launch for
   anyone in Kyiv or Kolkata.
6. **`Temporal.*.compare`, never `>` or `<`.** Temporal throws from `valueOf`, and
   `findIndex` on an empty array never runs its predicate, which is how this hid
   for a long time.
7. **Never set a width or colour on an individual calendar line** —
   `--calendar-hairline-width` / `--calendar-hairline-color` drive all of them.
8. **`useSectionResize` requires exactly three `.dispatcher-section` nodes.**
9. **A band's width says nothing about which local times exist** — bands are
   clipped for drawing only.
10. **Modal mounts are conditional, keyed by entity id, with `isOpen` a literal.**
11. **A repository return type with more than ~7 properties needs a named
    `interface`**, or nestia emits invalid TypeScript and `tsc` then reports *no
    type errors at all* anywhere in `src/`.

---

## 11. Prerequisites and loose ends in the current code

Things that are already broken or missing, which this work either trips over or
has to fix first.

| | |
|---|---|
| The whole events-display slice is **uncommitted** | `spread.projects.to.events.ts` is staged-but-modified; `dateConversions.ts` is untracked. Commit before branching work off it. |
| `useTimezone.test.ts` fails | Renamed to the non-strict `getTimezoneAtMoment` but still passes `new Date(...)` where an `Instant` is required, and still expects `null` where the device fallback now returns a zone. It was meant to target `getTimezoneAtMomentStrict`. |
| `console.log({ absoluteFrom })` | `spread.projects.to.events.ts:62`, in the hot path, once per external component per render. |
| No test for `spreadProjectsToEvents` | The folder holds one file and nothing else. The cadence rules in §4 are exactly the kind of thing that needs tests before code. |
| No shared event type | `{start, end, project}` is inferred in the producer and re-declared inline as `CalendarProps.newEvents`. |
| `GET /event` returns `PrismaPromise` | The service must `await`. `CLAUDE.md` documents this failure mode in detail. |
| `CreateEventDto` / `UpdateEventDto` are `{}` | And every write handler on `EventsController` is an empty stub. |
| `TimeComponentsController`'s writes are stubs too | Components are only ever written through `POST /project` and `PATCH /project`. |
| No `mobile/src/api/event.ts` | `api/project.ts` is the pattern to copy, including its `optimistically` helper. |
| `fromDateToPlainDateTime` missing | And `fromPlainDateTimeToDate` drops milliseconds. |
| `updateProject` is not transactional | Unlike `moveProject`. |
| `deleteTimeComponent` hard-deletes events | §3.2(c). |
| `testEvents` and `DEFAULT_RANGE` | Still hardcoded to August 2026. |
| `layoutStorage.ts:87` | A stray `console.log` in `setDateFrame`. |

---

## 12. Open decisions

Settled above and not open: the plan is stored as per-project entries over a
range (§3.3, §7.7); projects are fetched whole and events range-filtered (§2.1);
a calendar edit is this-occurrence-only (§6.6).

#### D1. Overlap tie-break for plan entries
Two `PlanEntry` rows can intersect one frame and disagree about `planPosition` or
the target. Proposed: **most specific range wins, then most recently updated** —
a user who planned a single day inside a week meant that day. The alternative,
plain `updatedAt DESC`, is simpler to implement and harder to predict.

#### D2. Do standalone events exist — **settled by `D-003`: yes**
`Event.timeComponentId` is nullable and `Event` is the row behind every
non-recurring entry. The worry recorded here — twenty dragged events becoming
twenty rows in `TimeComponentsBlock` — turned out not to apply: that list
already showed exact-time entries and still does, so nothing was added to it.
The alternative (an ad-hoc event as an `ABSOLUTE` `TimeComponent`) is gone with
the `type` column.

#### D3. What happens to an orphaned exception
A cadence edit can leave an exception with no occurrence to attach to. Options:
promote it to a standalone event (honest — the user moved it deliberately), hide
it (data kept, user confused), or delete it (destroys work). Related: the user
should probably be warned when an edit will orphan exceptions, which is a
prerequisite for anything except promotion.

#### D4. Cancelling a single occurrence
There is no way to skip an occurrence without editing the rule. It needs a column
on `Event` (`isCancelled`, or a status) and a delete affordance on the grid. Not
in the decided scope, near-certain to be asked for.

#### D5. Occurrence identity — still open, still free
§5 recommends `(recurringTimeSlotsId, occurrenceDate)` and argues the current
index-based constraint corrupts silently on any cadence edit. `D-003`
deliberately left both the column and the key alone: nothing creates an
exception yet, and a column nothing writes is one the next reader has to ask
about. `Event` holds only standalone rows, whose `recurringTimeSlotsId` is NULL
and therefore unconstrained, so the deadline has not passed — the migration is
still free when the work that needs it starts.

#### D6. What `FLEXIBLE` slots mean to the plan
They carry `flexibleMinutesNeeded` and no placement, so they produce no calendar
event. Proposed: they are **unscheduled demand shown separately**, not work that
satisfies a target — a slot that says "90 minutes somewhere today" has not been
scheduled yet, and counting it as covered defeats the point of the error.

#### D7. Colour inheritance for events
The ancestor walk lives inside `buildSectionRows` and is per-section and
per-category. The calendar needs the same colours. Lift it out, and decide what
"category" means to an event whose project is in BACKLOG — a backlogged project
with a scheduled event is a state that can exist.

#### D8. Is play/stop in scope
No timer model exists. §7.4. Recommended: its own document, its own work, and a
PLAN row that reserves the space for now.

#### D9. Can PLAN DnD reparent
Proposed: no — reorder siblings only. Reparenting would let a gesture in one
frame's derived tree edit `parentProjectId` globally.

#### D10. Metadata line, finalised
§7.4 lists what is known. The exact strings, the truncation order at 360 px, and
what a project with several occurrences in one frame shows on a single line are
all unsettled.

#### D11. Does PLAN show events as child rows
The mock shows nested rows carrying concrete times under a project row. Either
PLAN's tree is the project hierarchy only (one row per project, metadata
summarising), or a project row can expand into its individual occurrences in the
frame. The second is more useful and makes the tree two kinds of node, which
affects DnD, the collapse rule and the swipe.
