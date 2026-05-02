-- ============================================================
-- V11 — Tables for ASSISTANT / ACCOUNTANT / MANAGER / DOCTOR cabinets
-- Adds infrastructure that was missing for 4 roles whose cabinets
-- existed only as 12-line stubs in the React frontend.
-- ============================================================

-- ─── DOCTOR: laboratory orders ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS laboratory_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
    lab_name        VARCHAR(255) NOT NULL,
    work_type       VARCHAR(100) NOT NULL,             -- crown, bridge, denture, scan…
    description     TEXT,
    status          VARCHAR(30) NOT NULL DEFAULT 'NEW',-- NEW, IN_LAB, READY, DELIVERED, REJECTED
    price           NUMERIC(12,2),
    currency        VARCHAR(3) DEFAULT 'UZS',
    sent_at         TIMESTAMPTZ,
    expected_at     TIMESTAMPTZ,
    received_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_lab_orders_clinic   ON laboratory_orders(clinic_id);
CREATE INDEX idx_lab_orders_doctor   ON laboratory_orders(doctor_id);
CREATE INDEX idx_lab_orders_patient  ON laboratory_orders(patient_id);
CREATE INDEX idx_lab_orders_status   ON laboratory_orders(status);

-- ─── DOCTOR: medical media (xrays, intraoral photos) ────────────────
CREATE TABLE IF NOT EXISTS medical_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
    uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    media_type      VARCHAR(30) NOT NULL,              -- XRAY, PHOTO, SCAN, DOCUMENT, VIDEO
    tooth_number    INTEGER,                           -- FDI 11..48 (NULL for general)
    title           VARCHAR(255),
    description     TEXT,
    file_url        VARCHAR(1000) NOT NULL,
    file_size       BIGINT,
    mime_type       VARCHAR(100),
    captured_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_medical_media_patient    ON medical_media(patient_id);
CREATE INDEX idx_medical_media_clinic     ON medical_media(clinic_id);
CREATE INDEX idx_medical_media_appt       ON medical_media(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_medical_media_type       ON medical_media(media_type);

-- ─── ASSISTANT: rooms (cabinets / chairs) ───────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    floor           INTEGER,
    room_number     VARCHAR(20),
    equipment       JSONB DEFAULT '[]'::jsonb,         -- list of equipment names
    status          VARCHAR(20) NOT NULL DEFAULT 'FREE',  -- FREE, BUSY, CLEANING, OUT_OF_SERVICE
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, name)
);
CREATE INDEX idx_rooms_clinic     ON rooms(clinic_id);
CREATE INDEX idx_rooms_status     ON rooms(clinic_id, status);

-- ─── ASSISTANT: materials catalogue + stock + usage ────────────────
CREATE TABLE IF NOT EXISTS materials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(100),
    category        VARCHAR(100),                       -- composite, anesthetic, instrument, ppe…
    unit            VARCHAR(20) NOT NULL DEFAULT 'pcs', -- pcs, ml, g, box
    price           NUMERIC(12,2),
    currency        VARCHAR(3) DEFAULT 'UZS',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, name)
);
CREATE INDEX idx_materials_clinic    ON materials(clinic_id);
CREATE INDEX idx_materials_category  ON materials(category);

CREATE TABLE IF NOT EXISTS materials_stock (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    quantity        NUMERIC(12,3) NOT NULL DEFAULT 0,
    min_quantity    NUMERIC(12,3) NOT NULL DEFAULT 0,
    last_restock_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(material_id, clinic_id)
);
CREATE INDEX idx_materials_stock_clinic   ON materials_stock(clinic_id);
CREATE INDEX idx_materials_stock_low      ON materials_stock(clinic_id) WHERE quantity < min_quantity;

CREATE TABLE IF NOT EXISTS materials_usage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id     UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
    used_by         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    quantity        NUMERIC(12,3) NOT NULL,
    note            TEXT,
    used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_materials_usage_clinic   ON materials_usage(clinic_id);
CREATE INDEX idx_materials_usage_appt     ON materials_usage(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX idx_materials_usage_date     ON materials_usage(used_at DESC);

-- ─── ASSISTANT: assistant<->doctor assignments per shift ────────────
CREATE TABLE IF NOT EXISTS assistant_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    assistant_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
    shift_date      DATE NOT NULL,
    shift_start     TIME,
    shift_end       TIME,
    status          VARCHAR(20) NOT NULL DEFAULT 'PLANNED', -- PLANNED, ACTIVE, DONE, CANCELLED
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_assistant_assign_clinic  ON assistant_assignments(clinic_id);
CREATE INDEX idx_assistant_assign_assist  ON assistant_assignments(assistant_id, shift_date);
CREATE INDEX idx_assistant_assign_doctor  ON assistant_assignments(doctor_id, shift_date);

-- ─── ACCOUNTANT: salary schemes + payouts ──────────────────────────
CREATE TABLE IF NOT EXISTS salaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL,              -- doctor, assistant, accountant, manager…
    scheme          VARCHAR(30) NOT NULL,              -- FIXED, PERCENT_REVENUE, HYBRID, PER_SERVICE
    base_amount     NUMERIC(14,2) DEFAULT 0,
    percent         NUMERIC(5,2),                       -- when PERCENT_*
    config          JSONB DEFAULT '{}'::jsonb,         -- extra parameters
    valid_from      DATE NOT NULL,
    valid_to        DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_salaries_clinic   ON salaries(clinic_id);
CREATE INDEX idx_salaries_user     ON salaries(user_id);
CREATE INDEX idx_salaries_active   ON salaries(clinic_id, is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS salary_payouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    salary_id       UUID NOT NULL REFERENCES salaries(id) ON DELETE CASCADE,
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    base_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
    bonus_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
    deduction       NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(14,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, PAID, CANCELLED
    paid_at         TIMESTAMPTZ,
    paid_by         UUID REFERENCES users(id),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_salary_payouts_clinic    ON salary_payouts(clinic_id);
CREATE INDEX idx_salary_payouts_user      ON salary_payouts(user_id);
CREATE INDEX idx_salary_payouts_period    ON salary_payouts(period_start, period_end);
CREATE INDEX idx_salary_payouts_status    ON salary_payouts(status);

-- ─── ACCOUNTANT: clinic expenses (rent, supplies, taxes…) ──────────
CREATE TABLE IF NOT EXISTS clinic_expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    category        VARCHAR(50) NOT NULL,             -- RENT, UTILITIES, SUPPLIES, MARKETING, TAX, OTHER
    title           VARCHAR(255) NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    spent_at        DATE NOT NULL,
    paid_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    counterparty    VARCHAR(255),
    receipt_url     VARCHAR(1000),
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_clinic_expenses_clinic   ON clinic_expenses(clinic_id);
CREATE INDEX idx_clinic_expenses_date     ON clinic_expenses(spent_at DESC);
CREATE INDEX idx_clinic_expenses_cat      ON clinic_expenses(category);

-- ─── ACCOUNTANT: debtors view (unpaid invoices past due) ────────────
CREATE OR REPLACE VIEW v_debtors AS
    SELECT
        i.id              AS invoice_id,
        i.invoice_number,
        i.clinic_id,
        i.patient_id,
        i.total           AS amount,
        i.currency,
        i.due_date,
        i.status,
        (NOW()::date - i.due_date) AS days_overdue,
        u.first_name      AS patient_first_name,
        u.last_name       AS patient_last_name,
        u.phone           AS patient_phone
    FROM invoices i
    LEFT JOIN users u ON u.id = i.patient_id
    WHERE i.status IN ('UNPAID', 'PARTIAL', 'OVERDUE', 'DRAFT')
      AND i.due_date IS NOT NULL
      AND i.due_date < NOW()::date;

-- ─── MANAGER: KPI targets per clinic / period ──────────────────────
CREATE TABLE IF NOT EXISTS manager_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    metric          VARCHAR(50) NOT NULL,             -- REVENUE, APPOINTMENTS, NEW_PATIENTS, AVG_CHECK, NPS
    target_value    NUMERIC(14,2) NOT NULL,
    actual_value    NUMERIC(14,2) DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(clinic_id, period_start, metric)
);
CREATE INDEX idx_manager_targets_clinic   ON manager_targets(clinic_id);
CREATE INDEX idx_manager_targets_period   ON manager_targets(period_start, period_end);

-- ─── MANAGER: KPI snapshot view (daily aggregate) ──────────────────
-- Revenue is derived via invoice → appointment because payments.invoice_id is canonical
CREATE OR REPLACE VIEW v_clinic_kpi_daily AS
    SELECT
        a.clinic_id,
        a.appointment_date                              AS day,
        COUNT(*)                                        AS appointments_count,
        COUNT(*) FILTER (WHERE a.status = 'COMPLETED')  AS completed_count,
        COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')    AS no_show_count,
        COUNT(*) FILTER (WHERE a.status = 'CANCELLED')  AS cancelled_count,
        COALESCE(SUM(pmt.amount) FILTER (WHERE pmt.status = 'PAID'), 0) AS revenue
    FROM appointments a
    LEFT JOIN invoices inv ON inv.appointment_id = a.id
    LEFT JOIN payments pmt ON pmt.invoice_id = inv.id
    GROUP BY a.clinic_id, a.appointment_date;

-- ─── MANAGER: doctor performance view ──────────────────────────────
CREATE OR REPLACE VIEW v_doctor_performance AS
    SELECT
        a.doctor_id,
        a.clinic_id,
        DATE_TRUNC('month', a.appointment_date::timestamp)::date  AS month,
        COUNT(*)                                       AS appointments_count,
        COUNT(*) FILTER (WHERE a.status = 'COMPLETED') AS completed_count,
        COUNT(*) FILTER (WHERE a.status = 'NO_SHOW')   AS no_show_count,
        COALESCE(SUM(pmt.amount) FILTER (WHERE pmt.status = 'PAID'), 0) AS revenue,
        COALESCE(AVG(dr.rating), 0)::numeric(3,2)      AS avg_rating
    FROM appointments a
    LEFT JOIN invoices inv       ON inv.appointment_id = a.id
    LEFT JOIN payments pmt       ON pmt.invoice_id = inv.id
    LEFT JOIN doctor_reviews dr  ON dr.doctor_id = a.doctor_id
    GROUP BY a.doctor_id, a.clinic_id, DATE_TRUNC('month', a.appointment_date::timestamp);

-- ─── Triggers: auto-update updated_at ───────────────────────────────
CREATE OR REPLACE FUNCTION trg_touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lab_orders_touch ON laboratory_orders;
CREATE TRIGGER trg_lab_orders_touch BEFORE UPDATE ON laboratory_orders
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_rooms_touch ON rooms;
CREATE TRIGGER trg_rooms_touch BEFORE UPDATE ON rooms
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

DROP TRIGGER IF EXISTS trg_materials_stock_touch ON materials_stock;
CREATE TRIGGER trg_materials_stock_touch BEFORE UPDATE ON materials_stock
    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
