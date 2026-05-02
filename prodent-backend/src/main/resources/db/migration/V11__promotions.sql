-- ============================================================
-- V11: Promotions (Акции) — admin-managed advertising offers
-- Promotions are created by platform admins on behalf of clinics
-- and doctors. They surface on the public landing page as a
-- premium advertising surface, so the schema supports targeting,
-- prioritization, multilingual content, and impression tracking.
-- ============================================================

CREATE TABLE IF NOT EXISTS promotions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content
    title               VARCHAR(255) NOT NULL,
    title_uz            VARCHAR(255),
    title_en            VARCHAR(255),
    description         TEXT,
    description_uz      TEXT,
    description_en      TEXT,
    terms               TEXT,                        -- T&C / fine print
    image_url           VARCHAR(500),
    badge_label         VARCHAR(50),                 -- "HOT", "NEW", "VIP" etc.
    cta_label           VARCHAR(80),                 -- custom call-to-action text

    -- Categorization
    category            VARCHAR(50) NOT NULL DEFAULT 'other',
    service_id          UUID REFERENCES services(id) ON DELETE SET NULL,

    -- Pricing / discount
    discount_type       VARCHAR(20) NOT NULL DEFAULT 'PERCENT',  -- PERCENT | FIXED
    discount            INTEGER NOT NULL DEFAULT 0,              -- when type=PERCENT (0-100)
    discount_amount     NUMERIC(12,2),                           -- when type=FIXED
    price               NUMERIC(12,2) NOT NULL DEFAULT 0,
    old_price           NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency            VARCHAR(3) NOT NULL DEFAULT 'UZS',

    -- Ownership / scope (one of clinic_id / doctor_id should be set)
    clinic_id           UUID REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id           UUID REFERENCES doctors(id) ON DELETE CASCADE,

    -- Targeting (geo + audience)
    target_cities       JSONB,                       -- ["Tashkent","Samarkand"] — null = all
    target_districts    JSONB,
    target_audience     VARCHAR(20) DEFAULT 'ALL',   -- ALL | NEW_PATIENTS | RETURNING

    -- Validity window
    valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until         TIMESTAMPTZ NOT NULL,

    -- Lifecycle
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT', -- DRAFT|ACTIVE|PAUSED|EXPIRED|ARCHIVED
    active              BOOLEAN NOT NULL DEFAULT TRUE,        -- legacy/UI flag

    -- Advertising — promotions are paid placements, so we rank them
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,        -- pin to top
    priority            INTEGER NOT NULL DEFAULT 0,            -- higher = earlier
    max_impressions     INTEGER,                               -- null = unlimited
    max_bookings        INTEGER,                               -- null = unlimited

    -- Counters (incremented atomically)
    impressions         BIGINT NOT NULL DEFAULT 0,
    clicks              BIGINT NOT NULL DEFAULT 0,
    bookings            INTEGER NOT NULL DEFAULT 0,

    -- Audit
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT promotions_owner_chk
        CHECK (clinic_id IS NOT NULL OR doctor_id IS NOT NULL),
    CONSTRAINT promotions_dates_chk
        CHECK (valid_until > valid_from),
    CONSTRAINT promotions_discount_chk
        CHECK (discount BETWEEN 0 AND 100)
);

CREATE INDEX idx_promotions_status_active
    ON promotions(status, active, valid_until)
    WHERE active = TRUE;
CREATE INDEX idx_promotions_clinic        ON promotions(clinic_id) WHERE clinic_id IS NOT NULL;
CREATE INDEX idx_promotions_doctor        ON promotions(doctor_id) WHERE doctor_id IS NOT NULL;
CREATE INDEX idx_promotions_category      ON promotions(category);
CREATE INDEX idx_promotions_valid_until   ON promotions(valid_until);
CREATE INDEX idx_promotions_priority      ON promotions(is_featured DESC, priority DESC, created_at DESC);

-- Per-click tracking (used for analytics and CTR computation)
CREATE TABLE IF NOT EXISTS promotion_clicks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id    UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(20) NOT NULL DEFAULT 'CLICK',  -- IMPRESSION | CLICK | BOOKING
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    referrer        VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promotion_clicks_promo  ON promotion_clicks(promotion_id, created_at DESC);
CREATE INDEX idx_promotion_clicks_event  ON promotion_clicks(promotion_id, event_type);
