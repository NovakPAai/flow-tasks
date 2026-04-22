-- AlterTable
ALTER TABLE "boards" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;
