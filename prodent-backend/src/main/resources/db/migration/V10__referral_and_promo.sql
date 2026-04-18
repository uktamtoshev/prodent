-- V10: Referral system and promo codes

-- Each user gets a unique referral code (auto-generated on first access)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by) WHERE invited_by IS NOT NULL;

-- Promo codes (admin-managed, one-time or multi-use)
CREATE TABLE IF NOT EXISTS promo_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50) NOT NULL UNIQUE,
    description     TEXT,
    discount_type   VARCHAR(20) NOT NULL DEFAULT 'FIXED',  -- FIXED or PERCENT
    discount_value  NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    max_uses        INTEGER,                               -- NULL = unlimited
    current_uses    INTEGER NOT NULL DEFAULT 0,
    valid_from      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until     TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track who used which promo code
CREATE TABLE IF NOT EXISTS promo_code_uses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id   UUID NOT NULL REFERENCES promo_codes(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    used_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(promo_code_id, user_id)
);

-- Referral bonus log (tracks what bonuses were given)
CREATE TABLE IF NOT EXISTS referral_bonuses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id     UUID NOT NULL REFERENCES users(id),
    referred_id     UUID NOT NULL REFERENCES users(id),
    bonus_amount    NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'UZS',
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',  -- PENDING, CREDITED, EXPIRED
    credited_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);
