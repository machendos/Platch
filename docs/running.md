# Running the app

How to bring a worktree up, how several worktrees coexist, and how to take one
down again. Local development only — there is no deployed app.

Nothing in committed source names a port or an address. Every such value lives
in a gitignored env file, so a branch cannot carry another machine's setup into
`main` and a fresh worktree cannot inherit a stale one.

---

## What each value is, and who reads it

| Value | Lives in | Read by |
|---|---|---|
| `PORT` | `backend/.env` | the Nest server, to choose where to listen |
| `DATABASE_URL` | `backend/.env` | Prisma — its `?schema=` picks this backend's own tables, when it has any |
| `PORT` | `mobile/.env.local` | `vite.config.ts`, to pin the frontend port instead of letting Vite pick |
| `VITE_API_HOST` | `mobile/.env.local` | `api.client.ts`, to reach *this* worktree's backend |
| `DEV_LAN_IP` | `mobile/.env.local` | `capacitor.config.ts`, to build the installed app's URL |

**`PORT` appears twice on purpose and means something different each time** —
the backend reads it from `backend/.env`, the frontend from `mobile/.env.local`.
Separate processes reading separate files, so they never collide, but the shared
name is worth knowing before it confuses someone.

`vite.config.ts` reads it with Vite's own `loadEnv`, which loads every key in
the file rather than only `VITE_`-prefixed ones. That is the config's view, not
the client's: what reaches `import.meta.env` in app code is still governed by
`envPrefix`, so `PORT` and `DEV_LAN_IP` never enter the bundle. Verified against
a production build — neither the key nor the LAN address appears in it, while
`VITE_API_HOST` does, which is the whole point of its prefix.

`ios:dev` is the exception: it passes `--port=${PORT:-5173}` from the *shell*,
not the file, because it starts a native shell rather than a Vite server. The
worktree holding the installed app is on 5173 anyway, so the default is
normally what you want; a different port has to be given inline.

Two defaults are deliberate rather than missing configuration:

- `api.client.ts` falls back to `http://localhost:3001` — the shared backend a
  frontend-only worktree borrows.
- `capacitor.config.ts` fixes the port at **5173** and throws if `DEV_LAN_IP` is
  unset. It throws rather than guesses because a wrong address here shows an
  empty app with nothing on screen explaining it.

## Procedure for a new worktree

**1. Decide what changes, and settle the ports.** Agree whether the feature
touches the backend, the frontend, or both. A side with no expected changes
uses the already-running default — 5173 for the frontend, 3001 for the backend
— and nothing new is started for it.

Ask which backend port to use; it is assigned, never discovered. The frontend
needs to be told where its backend is before it starts, so "next free port"
cannot work for the backend the way it does for Vite.

Also settle whether this feature needs the **installed app**. Only one worktree
can hold it, because the app's URL is baked in when it is installed and points
at port 5173. Handing it over is a conversation, not a command: the worktree
currently holding it is told to free the app, moves its own frontend to another
free port, and only then is this worktree told 5173 is available.

**2. Write the ports into the env files.** `PORT` and `DATABASE_URL` in
`backend/.env`, `VITE_API_HOST` and `DEV_LAN_IP` in `mobile/.env.local`. Both
files are gitignored and belong to the worktree, not the branch.

**3. Migrate — only if this worktree runs its own backend.** The schema
belongs to the backend process, not to the worktree, so a frontend-only
worktree creates nothing: it talks to the default backend on 3001 and to the
default `public` schema behind it. The consequence is worth being clear about —
it also sees whatever schema changes other branches have applied there, which
is exactly the interference the split exists to avoid. That is the price of not
running your own, and it is usually the right price for frontend-only work.

A worktree that *does* run its own backend owns a Postgres schema, so a
migration on one branch cannot disturb another. Name it in the connection
string:

```bash
DATABASE_URL="postgresql://…/platch?schema=wt_<worktree-name>"
```

Then `npx prisma migrate deploy --schema src/system/database/schema.prisma`.
There is no separate create step — Prisma makes the schema if it is missing and
puts its own `_prisma_migrations` inside it, which is what isolates migration
state as well as tables. Verified by migrating into a fresh schema: seven
tables landed there and `public` was untouched.

The schema starts empty and **is not seeded** — seed data differs per feature,
and adding it ad hoc when the work needs it costs nothing.

Start only the servers this feature changes. The other side, if it has one,
stays on the default that is already running.

**4. Commit and open a PR only when asked.** Work stays uncommitted so it can
be reviewed in WebStorm's Commit window, unless the worktree has been given its
own automatic-commit rule. No mention of Claude anywhere — not in a commit
message, not in a PR body, not in an issue.

**5. Clean up when asked.** See below.

## Four ways to view the app, and only one uses Capacitor

| How | Loads | Capacitor |
|---|---|---|
| Browser on this Mac | `http://localhost:<port>` | no |
| Simulator Safari | `http://<DEV_LAN_IP>:<port>` | no |
| `npm run ios:dev` | the port it is given, in the simulator or a wired device | yes |
| The app already installed on the phone | `capacitor.config.ts`'s `server.url` | yes |

The first two are plain browsers hitting plain URLs, which is why a worktree on
any port needs no Capacitor configuration at all — and per `CLAUDE.md`,
simulator Safari covers almost everything device-specific.

`ios:dev` passes `--port=${PORT:-5173}` from the shell rather than from
`mobile/.env.local` — same name, different source, because it starts a native
shell instead of a Vite server. Defaulting to 5173 is right for the worktree
holding the app; anywhere else the port has to be given inline.

`capacitor.config.ts` fixes 5173 because it describes the app **already
installed** on the phone, whose URL was baked in at install time. Changing it
means rebuilding and reinstalling, which is why the device is handed over by
claiming 5173 rather than by reinstalling.

## Frontend ports allocate themselves

Vite takes the next free port when 5173 is busy and prints where it landed, and
`npm run dev` passes `--host`, so it is reachable at `http://<DEV_LAN_IP>:<port>`
as well as on localhost. Nothing needs configuring for that.

Set `PORT` in `mobile/.env.local` to pin it instead — which the worktree
holding the installed app must do, since that app only ever looks at 5173.

## Teardown

Everything a finished worktree holds, in the order it is safe to release:

1. stop its Vite and backend processes
2. `DROP SCHEMA wt_<worktree-name> CASCADE` — only if this worktree created
   one; a frontend-only worktree has nothing to drop and must not touch
   `public`
3. `git worktree remove`, and delete the branch once it is merged
4. delete the worktree's `node_modules` — both packages get their own, and this
   is the largest thing left behind and the easiest to forget
5. delete any `backup/*` refs created while merging

The env files go with the directory, so there is nothing separate to undo.

## Known issues / watch list

| Issue | Detail |
|---|---|
| `preview_start` resolves `.claude/launch.json` against the primary checkout | It runs `npm run dev --prefix mobile` with the main checkout as its working directory, so it serves `main` rather than the worktree — silently, because the app loads and looks right. Start Vite from the worktree and point the browser pane at its URL instead. |
| Backends predating this convention share `public` | Any worktree already running its own backend against `public` still disturbs the others when it migrates. Give each one a schema as it is next touched. Frontend-only worktrees are unaffected — sharing `public` is what they are supposed to do. |

