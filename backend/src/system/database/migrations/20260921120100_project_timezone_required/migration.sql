-- AlterTable
-- A time component is stored as a wall clock, so a project that cannot say
-- which zone to read it in cannot be resolved at all. Rows that predate the
-- column have no recorded zone, and UTC is the only fill that is not a guess
-- about where someone was.
UPDATE "Project" SET "originalTimezone" = 'UTC' WHERE "originalTimezone" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "originalTimezone" SET NOT NULL;
