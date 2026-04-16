-- ============================================================
-- PRODENT Enterprise Dental Platform — Initial Schema
-- Designed for: 1000+ clinics, 100K+ doctors, 10M+ patients
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- Use gen_random_uuid() instead of uuid-ossp (built-in since PG 13)

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    phone           VARCHAR(20) UNIQUE,
    password_hash   VARCHAR(255),
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    middle_name     VARCHAR(100),
    avatar_url      VARCHAR(500),
    gender          VARCHAR(20),
    date_of_birth   DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    language        VARCHAR(5) NOT NULL DEFAULT 'ru',
    country         VARCHAR(5) NOT NULL DEFAULT 'UZ',
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_name_trgm ON users USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

CREATE TABLE user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    clinic_id   UUID, -- NULL for global roles
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by  UUID REFERENCES users(id),
    UNIQUE(user_id, role, clinic_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_clinic ON user_roles(clinic_id) WHERE clinic_id IS NOT NULL;

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    device_info     VARCHAR(500),
    ip_address      VARCHAR(45),
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE revoked_at IS NULL;

CREATE TABLE phone_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           VARCHAR(20) NOT NULL,
    code            VARCHAR(10) NOT NULL,
    verification_type VARCHAR(50) NOT NULL DEFAULT 'PHONE',
    attempts        INT NOT NULL DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phone_verifications_phone ON phone_verifications(phone, is_verified);

CREATE TABLE email_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    code            VARCHAR(10) NOT NULL,
    attempts        INT NOT NULL DEFAULT 0,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLINICS
-- ============================================================

CREATE TABLE clinics (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) UNIQUE NOT NULL,
    description         TEXT,
    logo_url            VARCHAR(500),
    cover_url           VARCHAR(500),
    phone               VARCHAR(20),
    email               VARCHAR(255),
    website             VARCHAR(500),
    address             TEXT NOT NULL,
    city                VARCHAR(100) NOT NULL,
    country             VARCHAR(5) NOT NULL DEFAULT 'UZ',
    latitude            DECIMAL(10, 7),
    longitude           DECIMAL(10, 7),
    working_hours       JSONB DEFAULT '{}',
    subscription_plan   VARCHAR(50) NOT NULL DEFAULT 'FREE',
    subscription_expires_at TIMESTAMPTZ,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    rating              DECIMAL(3, 2) DEFAULT 0.00,
    review_count        INT DEFAULT 0,
    owner_id            UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinics_city ON clinics(city, country);
CREATE INDEX idx_clinics_slug ON clinics(slug);
CREATE INDEX idx_clinics_owner ON clinics(owner_id);
CREATE INDEX idx_clinics_name_trgm ON clinics USING gin (name gin_trgm_ops);
CREATE INDEX idx_clinics_location ON clinics(latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TABLE clinic_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id               UUID NOT NULL UNIQUE REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_duration    INT NOT NULL DEFAULT 30,
    max_advance_booking_days INT NOT NULL DEFAULT 30,
    auto_confirm_appointments BOOLEAN DEFAULT FALSE,
    sms_notifications       BOOLEAN DEFAULT TRUE,
    email_notifications     BOOLEAN DEFAULT TRUE,
    queue_enabled           BOOLEAN DEFAULT TRUE,
    online_booking_enabled  BOOLEAN DEFAULT TRUE,
    settings_json           JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clinic_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, user_id, role)
);

CREATE INDEX idx_clinic_members_clinic ON clinic_members(clinic_id);
CREATE INDEX idx_clinic_members_user ON clinic_members(user_id);

CREATE TABLE clinic_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    clinic_name     VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    email           VARCHAR(255),
    address         TEXT NOT NULL,
    city            VARCHAR(100) NOT NULL,
    country         VARCHAR(5) NOT NULL DEFAULT 'UZ',
    license_number  VARCHAR(100),
    documents_urls  JSONB DEFAULT '[]',
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCTORS
-- ============================================================

CREATE TABLE specialties (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ru VARCHAR(255) NOT NULL,
    name_uz VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    name_kz VARCHAR(255),
    name_kg VARCHAR(255),
    slug    VARCHAR(255) UNIQUE NOT NULL,
    icon    VARCHAR(100)
);

CREATE TABLE doctors (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    bio                 TEXT,
    experience_years    INT DEFAULT 0,
    education           JSONB DEFAULT '[]',
    certificates        JSONB DEFAULT '[]',
    consultation_price  DECIMAL(12, 2),
    currency            VARCHAR(3) DEFAULT 'UZS',
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    is_accepting_patients BOOLEAN DEFAULT TRUE,
    rating              DECIMAL(3, 2) DEFAULT 0.00,
    review_count        INT DEFAULT 0,
    subscription_plan   VARCHAR(50) NOT NULL DEFAULT 'FREE',
    subscription_expires_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_user ON doctors(user_id);
CREATE INDEX idx_doctors_rating ON doctors(rating DESC) WHERE is_verified = TRUE AND is_accepting_patients = TRUE;

CREATE TABLE doctor_specialties (
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    specialty_id    UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    is_primary      BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (doctor_id, specialty_id)
);

CREATE TABLE doctor_clinic_affiliations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id           UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id           UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    cooperation_type    VARCHAR(50) NOT NULL DEFAULT 'STAFF_DOCTOR',
    salary_percent      DECIMAL(5, 2),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,
    UNIQUE(doctor_id, clinic_id)
);

CREATE INDEX idx_doctor_affiliations_doctor ON doctor_clinic_affiliations(doctor_id);
CREATE INDEX idx_doctor_affiliations_clinic ON doctor_clinic_affiliations(clinic_id);

CREATE TABLE doctor_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    specialty           VARCHAR(255) NOT NULL,
    experience_years    INT NOT NULL,
    clinic_name         VARCHAR(255),
    license_number      VARCHAR(100),
    documents_urls      JSONB DEFAULT '[]',
    status              VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctor_schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    slot_duration INT NOT NULL DEFAULT 30,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(doctor_id, clinic_id, day_of_week)
);

CREATE INDEX idx_doctor_schedules_doctor_clinic ON doctor_schedules(doctor_id, clinic_id);

-- ============================================================
-- SERVICES
-- ============================================================

CREATE TABLE services (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name_ru     VARCHAR(255) NOT NULL,
    name_uz     VARCHAR(255),
    name_en     VARCHAR(255),
    category    VARCHAR(100),
    price       DECIMAL(12, 2) NOT NULL,
    currency    VARCHAR(3) DEFAULT 'UZS',
    duration    INT DEFAULT 30,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_services_clinic ON services(clinic_id);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE TABLE appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES users(id),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    service_id      UUID REFERENCES services(id),
    appointment_date DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    notes           TEXT,
    cancel_reason   TEXT,
    total_price     DECIMAL(12, 2),
    currency        VARCHAR(3) DEFAULT 'UZS',
    confirmed_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date, clinic_id);
CREATE INDEX idx_appointments_status ON appointments(status) WHERE status IN ('PENDING', 'CONFIRMED', 'IN_PROGRESS');

CREATE TABLE appointment_services (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    service_id      UUID NOT NULL REFERENCES services(id),
    quantity        INT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(12, 2) NOT NULL,
    total_price     DECIMAL(12, 2) NOT NULL,
    tooth_number    INT
);

CREATE INDEX idx_appointment_services_appt ON appointment_services(appointment_id);

CREATE TABLE appointments_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    queue_number    INT NOT NULL,
    arrival_time    TIMESTAMPTZ,
    start_time      TIMESTAMPTZ,
    completion_time TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queue_clinic_date ON appointments_queue(clinic_id, created_at);

-- ============================================================
-- MEDICAL RECORDS
-- ============================================================

CREATE TABLE medical_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES users(id),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    appointment_id  UUID REFERENCES appointments(id),
    diagnosis       TEXT,
    treatment       TEXT,
    notes           TEXT,
    attachments     JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor ON medical_records(doctor_id);

CREATE TABLE dental_chart (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES users(id),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    tooth_number    INT NOT NULL CHECK (tooth_number BETWEEN 11 AND 85),
    condition       VARCHAR(50) NOT NULL,
    diagnosis       TEXT,
    treatment       TEXT,
    notes           TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dental_chart_patient ON dental_chart(patient_id);
CREATE INDEX idx_dental_chart_patient_tooth ON dental_chart(patient_id, tooth_number);

CREATE TABLE treatment_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES users(id),
    doctor_id       UUID NOT NULL REFERENCES doctors(id),
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
    total_cost      DECIMAL(12, 2) DEFAULT 0,
    currency        VARCHAR(3) DEFAULT 'UZS',
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treatment_plans_patient ON treatment_plans(patient_id);

CREATE TABLE treatment_plan_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_plan_id   UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    service_id          UUID REFERENCES services(id),
    tooth_number        INT,
    description         VARCHAR(500) NOT NULL,
    quantity            INT NOT NULL DEFAULT 1,
    unit_price          DECIMAL(12, 2) NOT NULL,
    total_price         DECIMAL(12, 2) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'PLANNED',
    completed_at        TIMESTAMPTZ,
    sort_order          INT DEFAULT 0
);

-- ============================================================
-- FINANCIAL
-- ============================================================

CREATE TABLE virtual_accounts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id),
    owner_type  VARCHAR(20) NOT NULL, -- 'DOCTOR' or 'CLINIC'
    clinic_id   UUID REFERENCES clinics(id),
    balance     DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    currency    VARCHAR(3) DEFAULT 'UZS',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, owner_type, clinic_id)
);

CREATE INDEX idx_virtual_accounts_owner ON virtual_accounts(owner_id);

CREATE TABLE virtual_account_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES virtual_accounts(id),
    amount              DECIMAL(15, 2) NOT NULL,
    balance_after       DECIMAL(15, 2) NOT NULL,
    transaction_type    VARCHAR(20) NOT NULL,
    description         TEXT,
    reference_id        VARCHAR(255),
    payment_provider    VARCHAR(50),
    payment_status      VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    metadata            JSONB DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_va_transactions_account ON virtual_account_transactions(account_id);
CREATE INDEX idx_va_transactions_created ON virtual_account_transactions(created_at);

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  VARCHAR(50) NOT NULL UNIQUE,
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    patient_id      UUID NOT NULL REFERENCES users(id),
    appointment_id  UUID REFERENCES appointments(id),
    subtotal        DECIMAL(12, 2) NOT NULL,
    discount        DECIMAL(12, 2) DEFAULT 0,
    tax             DECIMAL(12, 2) DEFAULT 0,
    total           DECIMAL(12, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    status          VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    due_date        DATE,
    paid_at         TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_clinic ON invoices(clinic_id);
CREATE INDEX idx_invoices_patient ON invoices(patient_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID REFERENCES invoices(id),
    clinic_id       UUID NOT NULL REFERENCES clinics(id),
    patient_id      UUID NOT NULL REFERENCES users(id),
    amount          DECIMAL(12, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    method          VARCHAR(50) NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    provider_tx_id  VARCHAR(255),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_clinic ON payments(clinic_id);
CREATE INDEX idx_payments_patient ON payments(patient_id);

CREATE TABLE cash_register (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id),
    opened_by   UUID NOT NULL REFERENCES users(id),
    opened_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at   TIMESTAMPTZ,
    closed_by   UUID REFERENCES users(id),
    opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    closing_balance DECIMAL(12, 2),
    notes       TEXT
);

-- ============================================================
-- REVIEWS & PORTFOLIO
-- ============================================================

CREATE TABLE doctor_reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id  UUID NOT NULL REFERENCES users(id),
    clinic_id   UUID REFERENCES clinics(id),
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctor_reviews_doctor ON doctor_reviews(doctor_id);

CREATE TABLE clinic_reviews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id  UUID NOT NULL REFERENCES users(id),
    rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clinic_reviews_clinic ON clinic_reviews(clinic_id);

CREATE TABLE doctor_portfolio (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    description TEXT,
    before_url  VARCHAR(500),
    after_url   VARCHAR(500),
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clinic_portfolio (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    description TEXT,
    image_url   VARCHAR(500) NOT NULL,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS & MESSAGING
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

CREATE TABLE chat_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID REFERENCES clinics(id),
    name        VARCHAR(255),
    type        VARCHAR(20) NOT NULL DEFAULT 'DIRECT',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_room_members (
    chat_room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chat_room_id, user_id)
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_room_id    UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    attachments     JSONB DEFAULT '[]',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_room ON messages(chat_room_id, created_at);

-- ============================================================
-- ADVERTISING
-- ============================================================

CREATE TABLE ad_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    price           DECIMAL(12, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    duration_days   INT NOT NULL,
    max_impressions INT,
    features        JSONB DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ad_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id),
    clinic_id       UUID REFERENCES clinics(id),
    package_id      UUID NOT NULL REFERENCES ad_packages(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    image_url       VARCHAR(500),
    target_url      VARCHAR(500),
    status          VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    target_cities   JSONB DEFAULT '[]',
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ NOT NULL,
    budget          DECIMAL(12, 2),
    spent           DECIMAL(12, 2) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ad_campaigns_owner ON ad_campaigns(owner_id);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status) WHERE status = 'ACTIVE';

CREATE TABLE ad_analytics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    impressions     INT DEFAULT 0,
    clicks          INT DEFAULT 0,
    conversions     INT DEFAULT 0,
    spend           DECIMAL(12, 2) DEFAULT 0,
    UNIQUE(campaign_id, date)
);

-- ============================================================
-- BADGES & CONTENT
-- ============================================================

CREATE TABLE badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url    VARCHAR(500),
    category    VARCHAR(100),
    criteria    JSONB DEFAULT '{}',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE badge_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    badge_id    UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id   UUID REFERENCES clinics(id),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(badge_id, user_id, clinic_id)
);

CREATE TABLE blog_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id   UUID NOT NULL REFERENCES users(id),
    title       VARCHAR(500) NOT NULL,
    slug        VARCHAR(500) UNIQUE NOT NULL,
    content     TEXT NOT NULL,
    excerpt     TEXT,
    cover_url   VARCHAR(500),
    tags        JSONB DEFAULT '[]',
    seo_title   VARCHAR(255),
    seo_description VARCHAR(500),
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    view_count  INT DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at) WHERE is_published = TRUE;

-- ============================================================
-- MEDICAL ACCESS & AUDIT
-- ============================================================

CREATE TABLE medical_access (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES users(id),
    granted_to      UUID NOT NULL REFERENCES users(id),
    clinic_id       UUID REFERENCES clinics(id),
    access_level    VARCHAR(20) NOT NULL DEFAULT 'READ',
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    UNIQUE(patient_id, granted_to, clinic_id)
);

CREATE INDEX idx_medical_access_patient ON medical_access(patient_id);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- CLINIC FOLLOWERS & POSTS
-- ============================================================

CREATE TABLE clinic_followers (
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (clinic_id, user_id)
);

CREATE TABLE clinic_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES users(id),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clinic_post_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES clinic_posts(id) ON DELETE CASCADE,
    media_url   VARCHAR(500) NOT NULL,
    media_type  VARCHAR(20) NOT NULL DEFAULT 'IMAGE',
    sort_order  INT DEFAULT 0
);

CREATE TABLE doctor_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    image_url   VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE inventory_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(100),
    unit        VARCHAR(50),
    quantity    DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_quantity DECIMAL(10, 2) DEFAULT 0,
    unit_price  DECIMAL(12, 2),
    supplier    VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_clinic ON inventory_items(clinic_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.columns
        WHERE column_name = 'updated_at' AND table_schema = 'public'
        GROUP BY table_name
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
            t, t
        );
    END LOOP;
END;
$$;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(p_clinic_id UUID)
RETURNS TEXT AS $$
DECLARE
    seq INT;
    prefix TEXT;
BEGIN
    SELECT COUNT(*) + 1 INTO seq FROM invoices WHERE clinic_id = p_clinic_id;
    prefix := 'INV-' || EXTRACT(YEAR FROM NOW());
    RETURN prefix || '-' || LPAD(seq::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;
