-- Add isActive field to users
ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- Add security audit fields to audit_logs
ALTER TABLE "audit_logs" ADD COLUMN "result" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "ip" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN "session_id" TEXT;

-- Add index on action for SIEM queries
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
