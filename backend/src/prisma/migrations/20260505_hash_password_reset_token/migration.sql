-- Stage 1 fix: Store only SHA-256 hash of password reset token, never the raw token.
-- Raw token is sent via email; only hash stored in DB — same pattern as refresh tokens.

-- Step 1: Add new hashed column (nullable during migration)
ALTER TABLE "password_reset_tokens" ADD COLUMN "token_hash" TEXT;

-- Step 2: Invalidate existing tokens — they were stored as plaintext,
-- so we cannot compute their hashes. It's safer to require re-request.
-- Set token_hash to a dummy that will never match.
UPDATE "password_reset_tokens" SET "token_hash" = 'invalidated-' || gen_random_uuid()::text WHERE "token_hash" IS NULL;

-- Step 3: Enforce not-null
ALTER TABLE "password_reset_tokens" ALTER COLUMN "token_hash" SET NOT NULL;

-- Step 4: Add unique constraint (replaces old "token" unique)
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE ("token_hash");

-- Step 5: Drop old plaintext column
ALTER TABLE "password_reset_tokens" DROP COLUMN "token";
