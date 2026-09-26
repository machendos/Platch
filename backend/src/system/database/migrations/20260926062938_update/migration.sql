/*
  Warnings:

  - Made the column `firstRecurringEventAt` on table `RecurringTimeComponent` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_recurringTimeComponentId_fkey";

-- AlterTable
ALTER TABLE "RecurringTimeComponent" ALTER COLUMN "firstRecurringEventAt" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_recurringTimeComponentId_fkey" FOREIGN KEY ("recurringTimeComponentId") REFERENCES "RecurringTimeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
