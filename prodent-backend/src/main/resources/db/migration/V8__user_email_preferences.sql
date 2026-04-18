-- V8: Add email preferences to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE;
