-- V4: Add district column to clinics table (expected by frontend)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS district VARCHAR(100);
