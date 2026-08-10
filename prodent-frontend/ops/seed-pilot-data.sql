-- ============================================================
-- PRODENT Pilot Seed Data
-- Run once on a fresh database after Flyway migrations.
-- Creates: admin user, specialties, sample clinic, sample doctor.
-- ============================================================

-- 1. Admin user (password: ProdentAdmin2026!)
-- BCrypt hash of "ProdentAdmin2026!" with cost 10
INSERT INTO users (id, email, phone, password_hash, first_name, last_name, is_active, is_verified, language, country)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@prodent.uz',
    '+998710000001',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Admin', 'PRODENT',
    true, true, 'ru', 'UZ'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'SUPER_ADMIN')
ON CONFLICT (user_id, role) WHERE clinic_id IS NULL DO NOTHING;

-- 2. Dental specialties
INSERT INTO specialties (name_ru, name_uz, name_en, slug, icon) VALUES
    ('Терапевт', 'Terapevt', 'Therapist', 'therapist', 'stethoscope'),
    ('Ортодонт', 'Ortodont', 'Orthodontist', 'orthodontist', 'align-left'),
    ('Хирург', 'Jarroh', 'Surgeon', 'surgeon', 'scissors'),
    ('Ортопед', 'Ortoped', 'Orthopedist', 'orthopedist', 'box'),
    ('Пародонтолог', 'Parodontolog', 'Periodontist', 'periodontist', 'heart'),
    ('Детский стоматолог', 'Bolalar stomatoligi', 'Pediatric Dentist', 'pediatric', 'baby'),
    ('Имплантолог', 'Implantolog', 'Implantologist', 'implantologist', 'plus-circle'),
    ('Эндодонтист', 'Endodontist', 'Endodontist', 'endodontist', 'target')
ON CONFLICT (slug) DO NOTHING;

-- 3. Sample pilot clinic
INSERT INTO clinics (id, name, slug, description, phone, email, address, city, country, owner_id, is_verified, is_active, subscription_plan)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'PRODENT Demo Clinic',
    'prodent-demo-clinic',
    'Демонстрационная клиника для пилотного тестирования платформы PRODENT.',
    '+998712000000',
    'clinic@prodent.uz',
    'ул. Навои, 1, Ташкент',
    'Ташкент',
    'UZ',
    'a0000000-0000-0000-0000-000000000001',
    true, true, 'PRO'
) ON CONFLICT (slug) DO NOTHING;

-- Clinic settings
INSERT INTO clinic_settings (clinic_id, appointment_duration, online_booking_enabled)
VALUES ('c0000000-0000-0000-0000-000000000001', 30, true)
ON CONFLICT (clinic_id) DO NOTHING;

-- 4. Sample doctor user (password: DoctorTest2026!)
INSERT INTO users (id, email, phone, password_hash, first_name, last_name, is_active, is_verified, language, country)
VALUES (
    'a0000000-0000-0000-0000-000000000002',
    'doctor@prodent.uz',
    '+998710000002',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Алишер', 'Каримов',
    true, true, 'ru', 'UZ'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000002', 'DOCTOR')
ON CONFLICT (user_id, role) WHERE clinic_id IS NULL DO NOTHING;

-- Doctor profile
INSERT INTO doctors (id, user_id, bio, experience_years, consultation_price, is_verified, rating, specialty, clinic_id, subscription_plan)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'Стоматолог-терапевт с 10-летним опытом. Специализация: лечение кариеса, эндодонтия.',
    10,
    150000,
    true, 4.8,
    'Терапевт',
    'c0000000-0000-0000-0000-000000000001',
    'FREE'
) ON CONFLICT (user_id) DO NOTHING;

-- Doctor-clinic affiliation
INSERT INTO doctor_clinic_affiliations (doctor_id, clinic_id, cooperation_type, is_active)
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'STAFF_DOCTOR', true)
ON CONFLICT (doctor_id, clinic_id) DO NOTHING;

-- Doctor schedule (Mon-Fri 9:00-18:00)
INSERT INTO doctor_schedules (doctor_id, clinic_id, day_of_week, start_time, end_time, slot_duration, is_active)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, '09:00', '18:00', 30, true),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 2, '09:00', '18:00', 30, true),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 3, '09:00', '18:00', 30, true),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 4, '09:00', '18:00', 30, true),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 5, '09:00', '18:00', 30, true)
ON CONFLICT (doctor_id, clinic_id, day_of_week) DO NOTHING;

-- 5. Sample services
INSERT INTO services (clinic_id, name_ru, name_uz, category, price, duration, is_active) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Консультация', 'Konsultatsiya', 'Диагностика', 50000, 30, true),
    ('c0000000-0000-0000-0000-000000000001', 'Лечение кариеса', 'Kariyes davolash', 'Лечение', 200000, 45, true),
    ('c0000000-0000-0000-0000-000000000001', 'Профессиональная чистка', 'Professional tozalash', 'Гигиена', 150000, 60, true),
    ('c0000000-0000-0000-0000-000000000001', 'Удаление зуба', 'Tish olish', 'Хирургия', 150000, 30, true),
    ('c0000000-0000-0000-0000-000000000001', 'Отбеливание', 'Oqartirish', 'Эстетика', 500000, 90, true),
    ('c0000000-0000-0000-0000-000000000001', 'Установка виниров', 'Vinir o''rnatish', 'Эстетика', 2000000, 60, true),
    ('c0000000-0000-0000-0000-000000000001', 'Имплантация', 'Implantatsiya', 'Имплантация', 3000000, 90, true)
ON CONFLICT DO NOTHING;

-- 6. Sample patient user (password: Patient2026Test!)
INSERT INTO users (id, email, phone, password_hash, first_name, last_name, is_active, is_verified, language, country)
VALUES (
    'a0000000-0000-0000-0000-000000000003',
    'patient@prodent.uz',
    '+998710000003',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'Мадина', 'Рахимова',
    true, true, 'ru', 'UZ'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000003', 'PATIENT')
ON CONFLICT (user_id, role) WHERE clinic_id IS NULL DO NOTHING;

-- ============================================================
-- Done. Test accounts:
--   Admin:   admin@prodent.uz   / ProdentAdmin2026!
--   Doctor:  doctor@prodent.uz  / DoctorTest2026!
--   Patient: patient@prodent.uz / Patient2026Test!
-- ============================================================
