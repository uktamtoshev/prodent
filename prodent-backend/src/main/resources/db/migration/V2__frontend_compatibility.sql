-- V2: Frontend compatibility - missing tables, views, and columns
-- Aligns the database schema with what the original Supabase frontend expects

-- ============================================================
-- 1. Add missing columns to doctors table
-- ============================================================
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty VARCHAR(200);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS price_from NUMERIC(12,2);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id);

-- ============================================================
-- 2. Create "profiles" VIEW on users table
--    Frontend expects: profiles(id, full_name, avatar_url, phone, email, ...)
-- ============================================================
CREATE OR REPLACE VIEW profiles AS
SELECT
    id,
    first_name || ' ' || last_name AS full_name,
    first_name,
    last_name,
    middle_name,
    avatar_url,
    phone,
    email,
    gender,
    date_of_birth,
    is_active,
    is_verified,
    language,
    country,
    last_login_at,
    created_at,
    updated_at
FROM users;

-- Make the profiles view updatable (for INSERT/UPDATE through the view)
CREATE OR REPLACE FUNCTION profiles_insert_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (id, first_name, last_name, middle_name, avatar_url, phone, email, gender, date_of_birth, is_active, is_verified, language, country)
    VALUES (
        COALESCE(NEW.id, gen_random_uuid()),
        COALESCE(split_part(NEW.full_name, ' ', 1), NEW.first_name, ''),
        COALESCE(
            CASE WHEN NEW.full_name IS NOT NULL AND position(' ' in NEW.full_name) > 0
                 THEN substring(NEW.full_name from position(' ' in NEW.full_name) + 1)
                 ELSE NEW.last_name
            END, ''),
        NEW.middle_name,
        NEW.avatar_url,
        NEW.phone,
        NEW.email,
        NEW.gender,
        NEW.date_of_birth,
        COALESCE(NEW.is_active, true),
        COALESCE(NEW.is_verified, false),
        COALESCE(NEW.language, 'ru'),
        COALESCE(NEW.country, 'UZ')
    )
    RETURNING * INTO NEW;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION profiles_update_trigger()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET
        first_name = COALESCE(
            CASE WHEN NEW.full_name IS NOT NULL THEN split_part(NEW.full_name, ' ', 1) ELSE NEW.first_name END,
            OLD.first_name),
        last_name = COALESCE(
            CASE WHEN NEW.full_name IS NOT NULL AND position(' ' in NEW.full_name) > 0
                 THEN substring(NEW.full_name from position(' ' in NEW.full_name) + 1)
                 ELSE NEW.last_name
            END,
            OLD.last_name),
        middle_name = COALESCE(NEW.middle_name, OLD.middle_name),
        avatar_url = COALESCE(NEW.avatar_url, OLD.avatar_url),
        phone = COALESCE(NEW.phone, OLD.phone),
        email = COALESCE(NEW.email, OLD.email),
        gender = COALESCE(NEW.gender, OLD.gender),
        date_of_birth = COALESCE(NEW.date_of_birth, OLD.date_of_birth),
        is_active = COALESCE(NEW.is_active, OLD.is_active),
        is_verified = COALESCE(NEW.is_verified, OLD.is_verified),
        language = COALESCE(NEW.language, OLD.language),
        country = COALESCE(NEW.country, OLD.country),
        updated_at = now()
    WHERE id = OLD.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_insert ON profiles;
CREATE TRIGGER profiles_insert
    INSTEAD OF INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION profiles_insert_trigger();

DROP TRIGGER IF EXISTS profiles_update ON profiles;
CREATE TRIGGER profiles_update
    INSTEAD OF UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION profiles_update_trigger();

-- ============================================================
-- 3. Create subscription_plans table
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    name_uz VARCHAR(100),
    name_en VARCHAR(100),
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'UZS',
    duration_days INTEGER NOT NULL DEFAULT 30,
    features JSONB DEFAULT '{}'::jsonb,
    max_appointments_per_month INTEGER,
    max_patients INTEGER,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Create add_on_services table
-- ============================================================
CREATE TABLE IF NOT EXISTS add_on_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    name_uz VARCHAR(200),
    name_en VARCHAR(200),
    description TEXT,
    service_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. Create add_on_pricing table
-- ============================================================
CREATE TABLE IF NOT EXISTS add_on_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    add_on_service_id UUID NOT NULL REFERENCES add_on_services(id) ON DELETE CASCADE,
    duration_days INTEGER NOT NULL,
    price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'UZS',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. Create add_on_purchases table
-- ============================================================
CREATE TABLE IF NOT EXISTS add_on_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    add_on_service_id UUID NOT NULL REFERENCES add_on_services(id),
    doctor_id UUID REFERENCES doctors(id),
    clinic_id UUID REFERENCES clinics(id),
    user_id UUID REFERENCES users(id),
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    payment_id UUID REFERENCES payments(id),
    amount NUMERIC(12,2),
    currency VARCHAR(3) DEFAULT 'UZS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. Create clinic_member_permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS clinic_member_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_member_id UUID NOT NULL REFERENCES clinic_members(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by UUID REFERENCES users(id),
    UNIQUE(clinic_member_id, permission)
);

-- ============================================================
-- 8. Create medical_record_access table
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_record_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medical_record_id UUID NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
    granted_to UUID NOT NULL REFERENCES users(id),
    access_level VARCHAR(20) DEFAULT 'READ',
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. Create doctor_clinic_requests table
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_clinic_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    message TEXT,
    requested_by VARCHAR(20) NOT NULL DEFAULT 'DOCTOR',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 10. Insert default subscription plans
-- ============================================================
INSERT INTO subscription_plans (name, slug, price, duration_days, features) VALUES
    ('Free', 'FREE', 0, 0, '{"max_appointments": 10, "max_patients": 50}'::jsonb),
    ('Basic', 'BASIC', 99000, 30, '{"max_appointments": 100, "max_patients": 500, "analytics": true}'::jsonb),
    ('Pro', 'PRO', 249000, 30, '{"max_appointments": -1, "max_patients": -1, "analytics": true, "priority_support": true}'::jsonb),
    ('Enterprise', 'ENTERPRISE', 499000, 30, '{"max_appointments": -1, "max_patients": -1, "analytics": true, "priority_support": true, "api_access": true}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 11. Insert default add-on services
-- ============================================================
INSERT INTO add_on_services (name, service_type) VALUES
    ('Priority Listing', 'PRIORITY_LISTING'),
    ('Featured Badge', 'FEATURED_BADGE'),
    ('Ad Campaign', 'AD_CAMPAIGN'),
    ('Extended Analytics', 'EXTENDED_ANALYTICS'),
    ('SMS Notifications', 'SMS_NOTIFICATIONS')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 12. Indexes for new tables
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_add_on_purchases_doctor ON add_on_purchases(doctor_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_add_on_purchases_clinic ON add_on_purchases(clinic_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_add_on_purchases_dates ON add_on_purchases(start_date, end_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_doctor_clinic_requests_status ON doctor_clinic_requests(status);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON doctors(clinic_id) WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors USING gin (specialty gin_trgm_ops) WHERE specialty IS NOT NULL;
