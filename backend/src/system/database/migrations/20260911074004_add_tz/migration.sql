-- CreateTable
CREATE TABLE "TimezoneChange" (
    "id" TEXT NOT NULL,
    "ianaTimezone" TEXT NOT NULL,
    "changesAt" TIMESTAMP(0) NOT NULL,
    "cityLabel" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TimezoneChange_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TimezoneChange" ADD CONSTRAINT "TimezoneChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
