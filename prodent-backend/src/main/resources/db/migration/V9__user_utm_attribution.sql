-- V9: Add UTM attribution columns to users (marketing tracking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(200);
