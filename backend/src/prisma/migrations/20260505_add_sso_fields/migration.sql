-- SSO preparation: Keycloak + Avanpost via standard OIDC.
-- Adds ssoSubjectId (composite key "<provider>:<sub>"), authProvider, ssoOnly to users table.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "sso_subject_id" TEXT,
  ADD COLUMN IF NOT EXISTS "auth_provider"  TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS "sso_only"       BOOLEAN NOT NULL DEFAULT false;

-- Migrate existing keycloakId values to ssoSubjectId with keycloak prefix
UPDATE "users"
  SET "sso_subject_id" = 'keycloak:' || "keycloakId"
  WHERE "keycloakId" IS NOT NULL AND "sso_subject_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_sso_subject_id_key" ON "users"("sso_subject_id");
