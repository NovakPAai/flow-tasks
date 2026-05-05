-- Stage 1: Remove raw API key from storage.
-- Only keyHash (SHA-256) and keyPrefix (first 12 chars, display only) are kept.
-- Safe migration: add → backfill → set not-null → drop.

-- Step 1: add nullable column
ALTER TABLE "api_keys" ADD COLUMN "key_prefix" TEXT;

-- Step 2: backfill from existing raw key (first 12 chars safe for display)
UPDATE "api_keys" SET "key_prefix" = LEFT("key", 12) WHERE "key_prefix" IS NULL;

-- Step 3: enforce not-null now that all rows are filled
ALTER TABLE "api_keys" ALTER COLUMN "key_prefix" SET NOT NULL;

-- Step 4: drop the raw key column and its unique index
ALTER TABLE "api_keys" DROP COLUMN "key";
