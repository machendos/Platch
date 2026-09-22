-- AlterTable
ALTER TABLE "TimeComponent" ADD COLUMN     "firstRecurringEventAt" TIMESTAMP(0);
ALTER TABLE "TimeComponent" ADD COLUMN     "lastRecurringEventAt" TIMESTAMP(0);

-- The anchor keeps the day it already had. A DATE's wall-clock reading is
-- 00:00 on that day, which is exactly what the new column stores, so the cast
-- is the whole migration of the value.
UPDATE "TimeComponent"
SET "firstRecurringEventAt" = "recurringStartDate"::timestamp
WHERE "recurringStartDate" IS NOT NULL;

-- DropColumn
ALTER TABLE "TimeComponent" DROP COLUMN "recurringStartDate";
