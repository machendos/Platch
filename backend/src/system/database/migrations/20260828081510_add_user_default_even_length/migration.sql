-- The column is NOT NULL and the schema carries no default: the service
-- supplies it on creation. Existing rows are backfilled with a default that is
-- dropped again in the same migration, so the database never becomes the place
-- that value is stated.
ALTER TABLE "User" ADD COLUMN "defaultEvenLengthMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "User" ALTER COLUMN "defaultEvenLengthMinutes" DROP DEFAULT;
