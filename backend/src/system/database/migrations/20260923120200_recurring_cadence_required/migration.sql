-- AlterTable
-- These were nullable only because this table used to hold ABSOLUTE rows too,
-- and those had no cadence. D-003 moved them out, so every remaining row is a
-- rule and must have both -- which the DTO validator has always required.
-- Nothing to backfill: no row has either as NULL.
ALTER TABLE "RecurringTimeComponent"
  ALTER COLUMN "recurringInterval" SET NOT NULL;
ALTER TABLE "RecurringTimeComponent"
  ALTER COLUMN "recurringFrequency" SET NOT NULL;
