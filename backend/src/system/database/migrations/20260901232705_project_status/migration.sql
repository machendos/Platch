CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'BACKLOG');

-- The column is NOT NULL and the schema carries no default: the form always
-- states a status, so the request supplies it. Existing rows are backfilled
-- with a default that is dropped again in the same migration, so the database
-- never becomes the place that value is stated. Projects that predate the
-- column were all being worked on, which is what ACTIVE means.
ALTER TABLE "Project" ADD COLUMN "projectStatus" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Project" ALTER COLUMN "projectStatus" DROP DEFAULT;
