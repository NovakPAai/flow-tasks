-- AlterTable: add key_hash as nullable first
ALTER TABLE "api_keys" ADD COLUMN "key_hash" TEXT;

-- Backfill: compute sha256 hash for existing rows
UPDATE "api_keys" SET "key_hash" = encode(sha256("key"::bytea), 'hex') WHERE "key_hash" IS NULL;

-- Now enforce NOT NULL and UNIQUE
ALTER TABLE "api_keys" ALTER COLUMN "key_hash" SET NOT NULL;
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
