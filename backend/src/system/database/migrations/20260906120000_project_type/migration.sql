-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('EXTERNAL', 'INTERNAL');

-- AlterTable
-- The default is temporary, so existing rows get a value and are then left
-- with none: the schema declares no default because the type is a decision
-- whoever creates a project makes.
ALTER TABLE "Project" ADD COLUMN "projectType" "ProjectType" NOT NULL DEFAULT 'EXTERNAL';
ALTER TABLE "Project" ALTER COLUMN "projectType" DROP DEFAULT;

-- DropColumn
ALTER TABLE "Project" DROP COLUMN "flexibleTimezone";
