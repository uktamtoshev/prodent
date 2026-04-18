-- V7: Add optimistic locking version column to virtual_accounts
ALTER TABLE virtual_accounts ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
