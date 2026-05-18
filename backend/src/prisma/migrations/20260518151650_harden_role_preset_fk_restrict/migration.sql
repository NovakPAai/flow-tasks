-- DropForeignKey
ALTER TABLE "board_members" DROP CONSTRAINT "board_members_role_preset_id_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_globalRolePresetId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_role_preset_id_fkey";

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_globalRolePresetId_fkey" FOREIGN KEY ("globalRolePresetId") REFERENCES "role_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_role_preset_id_fkey" FOREIGN KEY ("role_preset_id") REFERENCES "role_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "board_members" ADD CONSTRAINT "board_members_role_preset_id_fkey" FOREIGN KEY ("role_preset_id") REFERENCES "role_presets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
