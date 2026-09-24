-- Postgres won't let a new enum value be used in the transaction that adds it,
-- so the clean vocals skills that reference it are seeded in the next migration.
ALTER TYPE guitar_path ADD VALUE IF NOT EXISTS 'clean_vocals';
