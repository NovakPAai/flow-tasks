-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "mfaGraceUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "mfaGraceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "requireMfa" BOOLEAN NOT NULL DEFAULT false;
