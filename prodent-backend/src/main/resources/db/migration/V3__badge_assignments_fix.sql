-- V3: Add missing columns to badge_assignments that the frontend expects

ALTER TABLE badge_assignments ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES doctors(id);
ALTER TABLE badge_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE badge_assignments ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ DEFAULT now();
ALTER TABLE badge_assignments ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year');

CREATE INDEX IF NOT EXISTS idx_badge_assignments_active ON badge_assignments(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_badge_assignments_doctor ON badge_assignments(doctor_id) WHERE doctor_id IS NOT NULL;
