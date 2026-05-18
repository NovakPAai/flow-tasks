-- Additive btree indexes to accelerate case-insensitive substring search
-- on users.name and users.email. Used by
--   GET /api/workspaces/:id/members/candidates
-- See docs/design/workspace-member-picker.md §6.
--
-- For < 10k users plain btree on lower(field) is sufficient. At larger
-- scale, switch to pg_trgm + gin_trgm_ops for unbounded contains search
-- (deferred follow-up).

CREATE INDEX IF NOT EXISTS "idx_users_email_lower" ON "users" (lower("email"));
CREATE INDEX IF NOT EXISTS "idx_users_name_lower"  ON "users" (lower("name"));
