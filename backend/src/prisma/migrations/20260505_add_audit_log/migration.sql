-- Stage 4: Add audit_logs table for admin action trail.
-- Fire-and-forget writes from admin service; actor is always an authenticated user.

CREATE TABLE "audit_logs" (
  "id"         TEXT NOT NULL,
  "actorId"    TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "targetId"   TEXT,
  "meta"       JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
