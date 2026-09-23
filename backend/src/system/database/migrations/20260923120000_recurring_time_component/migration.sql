-- AlterTable
-- "end" is an SQL reserved word; every reference to it here is quoted.
ALTER TABLE "Event" RENAME COLUMN "absoluteFrom" TO "start";
ALTER TABLE "Event" RENAME COLUMN "absoluteTo" TO "end";

-- A standalone event has no rule to point at. The unique key below is left
-- exactly as it was: Postgres treats NULLs as distinct, so every standalone row
-- carries (NULL, NULL) and none of them collide.
ALTER TABLE "Event" ALTER COLUMN "timeComponentId" DROP NOT NULL;

-- An ABSOLUTE component was always one span with no cadence, which is an event.
-- It becomes a standalone one. `id` has no database default -- Prisma mints
-- uuids client-side -- so the migration mints its own.
INSERT INTO "Event" ("id", "projectId", "timeComponentId", "start", "end")
SELECT gen_random_uuid()::text, "projectId", NULL, "absoluteFrom", "absoluteTo"
FROM "TimeComponent"
WHERE "type" = 'ABSOLUTE';

DELETE FROM "TimeComponent" WHERE "type" = 'ABSOLUTE';

-- RenameTable
-- A rename rather than a copy: RecurringTimeSlots and Event both point at this
-- table, so a new one would mean dropping and rebuilding two foreign keys to
-- land in the same place. The constraints are renamed with it so a later diff
-- has nothing to say about them.
ALTER TABLE "TimeComponent" RENAME TO "RecurringTimeComponent";
ALTER TABLE "RecurringTimeComponent"
  RENAME CONSTRAINT "TimeComponent_pkey" TO "RecurringTimeComponent_pkey";
ALTER TABLE "RecurringTimeComponent"
  RENAME CONSTRAINT "TimeComponent_projectId_fkey"
  TO "RecurringTimeComponent_projectId_fkey";

-- DropColumn
ALTER TABLE "RecurringTimeComponent" DROP COLUMN "type",
DROP COLUMN "absoluteFrom",
DROP COLUMN "absoluteTo";

-- DropEnum
-- Only reachable once the column that used it is gone; Postgres refuses
-- otherwise, so the ordering above is the whole risk in this file.
DROP TYPE "TimeComponentType";
