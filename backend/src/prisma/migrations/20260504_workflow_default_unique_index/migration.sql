-- Step 1: demote duplicate isDefault=true workflows (keep oldest per workspace).
-- Safe on clean data (UPDATE touches 0 rows); repairs dirty data before index creation.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt" ASC) AS rn
  FROM   "workflows"
  WHERE  "isDefault" = true
)
UPDATE "workflows"
SET    "isDefault" = false
WHERE  id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: enforce at most one default workflow per workspace at the DB level.
-- A partial unique index is not expressible via Prisma schema directly.
CREATE UNIQUE INDEX IF NOT EXISTS "workflows_workspace_default_unique"
  ON "workflows" ("workspaceId")
  WHERE "isDefault" = true;
