-- DropIndex
DROP INDEX "Project_prevProjectIdInHierarchy_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "prevProjectIdInHierarchy",
ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'a0';

-- Fractional keys are generated and compared byte-wise by the client. Under a
-- locale collation the database orders 'A' and 'a' differently and silently
-- disagrees with it, so the column is pinned to byte order before the index
-- below is built on it.
ALTER TABLE "Project" ALTER COLUMN "position" TYPE TEXT COLLATE "C";

-- CreateIndex
CREATE INDEX "Project_userId_projectStatus_parentProjectId_position_idx" ON "Project"("userId", "projectStatus", "parentProjectId", "position");
