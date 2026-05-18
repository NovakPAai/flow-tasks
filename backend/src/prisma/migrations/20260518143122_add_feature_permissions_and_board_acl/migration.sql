-- CreateEnum
CREATE TYPE "PermissionCode" AS ENUM ('TASK_READ', 'BOARD_READ', 'WORKFLOW_READ', 'LABEL_READ', 'COMMENT_READ', 'CHECKLIST_READ', 'HISTORY_READ', 'WORKSPACE_READ', 'TASK_CREATE', 'TASK_UPDATE', 'TASK_DELETE', 'TASK_REASSIGN', 'TASK_BULK_EDIT', 'TASK_EXPORT', 'BOARD_CREATE', 'BOARD_UPDATE', 'BOARD_DELETE', 'BOARD_MANAGE_COLUMNS', 'BOARD_MANAGE_ACL', 'WORKFLOW_CREATE', 'WORKFLOW_UPDATE', 'WORKFLOW_DELETE', 'LABEL_CREATE', 'LABEL_UPDATE', 'LABEL_DELETE', 'COMMENT_CREATE', 'COMMENT_UPDATE_OWN', 'COMMENT_DELETE_OWN', 'COMMENT_DELETE_ANY', 'CHECKLIST_WRITE', 'WS_INVITE_MEMBER', 'WS_REMOVE_MEMBER', 'WS_CHANGE_MEMBER_ROLE', 'WS_EDIT_SETTINGS', 'WS_EDIT_SECURITY', 'WS_TOGGLE_FEATURES', 'WS_DELETE', 'WS_RESTORE_FROM_TRASH', 'ADMIN_USERS', 'ADMIN_ROLES', 'ADMIN_PERMISSIONS', 'ADMIN_AUDIT', 'ADMIN_FEATURE_FLAGS', 'ADMIN_SYSTEM_CONFIG');

-- CreateEnum
CREATE TYPE "PermissionType" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "FeatureScope" AS ENUM ('SYSTEM', 'WORKSPACE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "globalRolePresetId" TEXT,
ADD COLUMN     "permissions_rev" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role_preset_id" TEXT;

-- CreateTable
CREATE TABLE "system_features" (
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_features_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "workspace_features" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "workspace_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "scope" "FeatureScope" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "permission" "PermissionCode" NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "permission" "PermissionCode" NOT NULL,
    "type" "PermissionType" NOT NULL,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "board_members" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role_preset_id" TEXT,
    "added_by" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_features_workspaceId_code_key" ON "workspace_features"("workspaceId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "role_presets_name_key" ON "role_presets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_presetId_permission_key" ON "role_permissions"("presetId", "permission");

-- CreateIndex
CREATE INDEX "user_permissions_userId_workspaceId_idx" ON "user_permissions"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_userId_workspaceId_permission_key" ON "user_permissions"("userId", "workspaceId", "permission");

-- CreateIndex
CREATE INDEX "board_members_userId_idx" ON "board_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "board_members_boardId_userId_key" ON "board_members"("boardId", "userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_globalRolePresetId_fkey" FOREIGN KEY ("globalRolePresetId") REFERENCES "role_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_role_preset_id_fkey" FOREIGN KEY ("role_preset_id") REFERENCES "role_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_features" ADD CONSTRAINT "workspace_features_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "role_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_role_preset_id_fkey" FOREIGN KEY ("role_preset_id") REFERENCES "role_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Seed + Backfill (G2-1, G2-2)
-- Idempotent — uses ON CONFLICT DO NOTHING for re-running safety.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Seed system feature flags (defaults: all enabled)
INSERT INTO "system_features" ("code", "enabled", "updatedAt") VALUES
  ('LOCAL_REGISTRATION',    true, NOW()),
  ('SSO',                   true, NOW()),
  ('MFA',                   true, NOW()),
  ('EMAIL_NOTIFICATIONS',   true, NOW()),
  ('FEEDBACK_WIDGET',       true, NOW()),
  ('API_KEYS',              true, NOW()),
  ('GLOBAL_SEARCH',         true, NOW()),
  ('REGISTRATION_REQUESTS', true, NOW())
ON CONFLICT ("code") DO NOTHING;

-- 2. Seed system role presets (fixed UUIDs for deterministic backfill)
INSERT INTO "role_presets" ("id", "name", "display_name", "scope", "is_system", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-000000000001', 'system:owner',  'Owner',  'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'system:member', 'Member', 'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'system:viewer', 'Viewer', 'WORKSPACE', true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'system:admin',  'Admin',  'SYSTEM',    true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- 3. Seed RolePermission for system:viewer (8 codes — READ only)
INSERT INTO "role_permissions" ("id", "presetId", "permission")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000003', p::"PermissionCode"
FROM (VALUES
  ('TASK_READ'), ('BOARD_READ'), ('WORKFLOW_READ'), ('LABEL_READ'),
  ('COMMENT_READ'), ('CHECKLIST_READ'), ('HISTORY_READ'), ('WORKSPACE_READ')
) AS t(p)
ON CONFLICT ("presetId", "permission") DO NOTHING;

-- 4. Seed RolePermission for system:member (viewer + non-destructive writes; without TASK_EXPORT — plan §Open Q1)
INSERT INTO "role_permissions" ("id", "presetId", "permission")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000002', p::"PermissionCode"
FROM (VALUES
  -- viewer baseline
  ('TASK_READ'), ('BOARD_READ'), ('WORKFLOW_READ'), ('LABEL_READ'),
  ('COMMENT_READ'), ('CHECKLIST_READ'), ('HISTORY_READ'), ('WORKSPACE_READ'),
  -- additions for member
  ('TASK_CREATE'), ('TASK_UPDATE'), ('TASK_REASSIGN'), ('TASK_BULK_EDIT'),
  ('BOARD_CREATE'), ('BOARD_UPDATE'),
  ('LABEL_CREATE'), ('LABEL_UPDATE'),
  ('COMMENT_CREATE'), ('COMMENT_UPDATE_OWN'), ('COMMENT_DELETE_OWN'),
  ('CHECKLIST_WRITE')
) AS t(p)
ON CONFLICT ("presetId", "permission") DO NOTHING;

-- 5. Seed RolePermission for system:owner (all workspace-scope permissions)
INSERT INTO "role_permissions" ("id", "presetId", "permission")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', p::"PermissionCode"
FROM (VALUES
  -- everything from member
  ('TASK_READ'), ('BOARD_READ'), ('WORKFLOW_READ'), ('LABEL_READ'),
  ('COMMENT_READ'), ('CHECKLIST_READ'), ('HISTORY_READ'), ('WORKSPACE_READ'),
  ('TASK_CREATE'), ('TASK_UPDATE'), ('TASK_REASSIGN'), ('TASK_BULK_EDIT'), ('TASK_EXPORT'),
  ('BOARD_CREATE'), ('BOARD_UPDATE'),
  ('LABEL_CREATE'), ('LABEL_UPDATE'),
  ('COMMENT_CREATE'), ('COMMENT_UPDATE_OWN'), ('COMMENT_DELETE_OWN'),
  ('CHECKLIST_WRITE'),
  -- owner additions
  ('TASK_DELETE'),
  ('BOARD_DELETE'), ('BOARD_MANAGE_COLUMNS'), ('BOARD_MANAGE_ACL'),
  ('LABEL_DELETE'),
  ('COMMENT_DELETE_ANY'),
  ('WORKFLOW_CREATE'), ('WORKFLOW_UPDATE'), ('WORKFLOW_DELETE'),
  ('WS_INVITE_MEMBER'), ('WS_REMOVE_MEMBER'), ('WS_CHANGE_MEMBER_ROLE'),
  ('WS_EDIT_SETTINGS'), ('WS_EDIT_SECURITY'), ('WS_TOGGLE_FEATURES'),
  ('WS_DELETE'), ('WS_RESTORE_FROM_TRASH')
) AS t(p)
ON CONFLICT ("presetId", "permission") DO NOTHING;

-- 6. Seed RolePermission for system:admin (system scope)
INSERT INTO "role_permissions" ("id", "presetId", "permission")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000004', p::"PermissionCode"
FROM (VALUES
  ('ADMIN_USERS'), ('ADMIN_ROLES'), ('ADMIN_PERMISSIONS'),
  ('ADMIN_AUDIT'), ('ADMIN_FEATURE_FLAGS'), ('ADMIN_SYSTEM_CONFIG')
) AS t(p)
ON CONFLICT ("presetId", "permission") DO NOTHING;

-- 7. Backfill WorkspaceMember.role_preset_id from legacy role enum
UPDATE "workspace_members"
   SET "role_preset_id" = '00000000-0000-0000-0000-000000000001'
 WHERE "role_preset_id" IS NULL AND "role" = 'OWNER';

UPDATE "workspace_members"
   SET "role_preset_id" = '00000000-0000-0000-0000-000000000002'
 WHERE "role_preset_id" IS NULL AND "role" = 'MEMBER';

UPDATE "workspace_members"
   SET "role_preset_id" = '00000000-0000-0000-0000-000000000003'
 WHERE "role_preset_id" IS NULL AND "role" = 'VIEWER';

-- 8. Backfill User.globalRolePresetId for superadmins
UPDATE "users"
   SET "globalRolePresetId" = '00000000-0000-0000-0000-000000000004'
 WHERE "globalRolePresetId" IS NULL AND "isSuperadmin" = true;

-- 9. Sanity: ensure no board has NULL is_private
UPDATE "boards" SET "isPrivate" = false WHERE "isPrivate" IS NULL;
