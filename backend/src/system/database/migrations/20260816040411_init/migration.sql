-- CreateEnum
CREATE TYPE "TimeComponentType" AS ENUM ('ABSOLUTE', 'RECURRING');

-- CreateEnum
CREATE TYPE "RecurringTimeSlotsType" AS ENUM ('ABSOLUTE', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "WEEKDAY" AS ENUM ('MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "context" TEXT,
    "timeNeededMinutes" INTEGER,
    "minBlockMinutes" INTEGER,
    "repetitionsNeeded" INTEGER,
    "earliestDate" DATE,
    "earliestTime" TIME(0),
    "deadlineDate" DATE,
    "deadlineTime" TIME(0),
    "flexibleTimezone" BOOLEAN NOT NULL,
    "originalTimezone" TEXT,
    "userId" TEXT NOT NULL,
    "parentProjectId" TEXT,
    "colorId" TEXT,
    "prevProjectIdInHierarchy" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeComponent" (
    "id" TEXT NOT NULL,
    "type" "TimeComponentType" NOT NULL,
    "absoluteFrom" TIMESTAMP(0),
    "absoluteTo" TIMESTAMP(0),
    "recurringInterval" INTEGER,
    "recurringFrequency" "RecurringFrequency",
    "recurringByDay" "WEEKDAY"[],
    "recurringByMonthDay" INTEGER,
    "recurringByMonth" INTEGER,
    "recurringStartDate" DATE,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "TimeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTimeSlots" (
    "id" TEXT NOT NULL,
    "type" "RecurringTimeSlotsType" NOT NULL,
    "from" TIME(0),
    "to" TIME(0),
    "flexibleMinutesNeeded" INTEGER,
    "timeComponentId" TEXT NOT NULL,

    CONSTRAINT "RecurringTimeSlots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "overridedName" TEXT,
    "overridedGoal" TEXT,
    "overridedContext" TEXT,
    "absoluteFrom" TIMESTAMP(0),
    "absoluteTo" TIMESTAMP(0),
    "recurringOccurrenceIndex" INTEGER,
    "projectId" TEXT NOT NULL,
    "timeComponentId" TEXT NOT NULL,
    "recurringTimeSlotsId" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Color" (
    "id" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "hexCode" TEXT NOT NULL,

    CONSTRAINT "Color_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_prevProjectIdInHierarchy_key" ON "Project"("prevProjectIdInHierarchy");

-- CreateIndex
CREATE UNIQUE INDEX "Event_recurringTimeSlotsId_recurringOccurrenceIndex_key" ON "Event"("recurringTimeSlotsId", "recurringOccurrenceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Color_placement_key" ON "Color"("placement");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_parentProjectId_fkey" FOREIGN KEY ("parentProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Color"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_prevProjectIdInHierarchy_fkey" FOREIGN KEY ("prevProjectIdInHierarchy") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeComponent" ADD CONSTRAINT "TimeComponent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTimeSlots" ADD CONSTRAINT "RecurringTimeSlots_timeComponentId_fkey" FOREIGN KEY ("timeComponentId") REFERENCES "TimeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_timeComponentId_fkey" FOREIGN KEY ("timeComponentId") REFERENCES "TimeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_recurringTimeSlotsId_fkey" FOREIGN KEY ("recurringTimeSlotsId") REFERENCES "RecurringTimeSlots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
