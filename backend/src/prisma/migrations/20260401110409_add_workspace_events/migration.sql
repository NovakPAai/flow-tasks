-- CreateTable
CREATE TABLE "workspace_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_events_workspaceId_createdAt_idx" ON "workspace_events"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_events" ADD CONSTRAINT "workspace_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
