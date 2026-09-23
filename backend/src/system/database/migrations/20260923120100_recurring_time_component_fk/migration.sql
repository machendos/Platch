-- AlterTable
-- The column named the table before it was split. Renamed with its constraint
-- so nothing is left pointing at a name that no longer exists.
ALTER TABLE "Event"
  RENAME COLUMN "timeComponentId" TO "recurringTimeComponentId";
ALTER TABLE "Event"
  RENAME CONSTRAINT "Event_timeComponentId_fkey"
  TO "Event_recurringTimeComponentId_fkey";

-- AlterTable
ALTER TABLE "RecurringTimeSlots"
  RENAME COLUMN "timeComponentId" TO "recurringTimeComponentId";
ALTER TABLE "RecurringTimeSlots"
  RENAME CONSTRAINT "RecurringTimeSlots_timeComponentId_fkey"
  TO "RecurringTimeSlots_recurringTimeComponentId_fkey";
