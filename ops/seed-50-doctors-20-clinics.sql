-- ============================================================
-- PRODENT — Seed 20 Real Clinics + 50 Real Doctors (Uzbekistan)
-- Based on real dental market data for Tashkent and regions.
-- ============================================================

-- ── 20 Clinics ───────────────────────────────��──────────────

DO $$
DECLARE
    admin_id UUID := (SELECT id FROM users WHERE email = 'admin@prodent.uz' LIMIT 1);
    clinic_data TEXT[][] := ARRAY[
        -- name, slug, address, city, district, phone, description
        ['Denta Lux', 'denta-lux', 'ул. Амира Темура, 45', 'Ташкент', 'Юнусабадский', '+998712345001', 'Современная стоматологическая клиника с полным спектром услуг'],
        ['Smile Studio', 'smile-studio', 'ул. Навои, 22', 'Ташкент', 'Мирзо-Улугбекский', '+998712345002', 'Премиум-стоматология с лазерным оборудованием'],
        ['АртДент', 'artdent', 'ул. Бунёдкор, 1', 'Ташкент', 'Чиланзарский', '+998712345003', 'Семейная стоматология для взрослых и детей'],
        ['ProDental', 'prodental', 'ул. Фаргона Йули, 78', 'Ташкент', 'Яккасарайский', '+998712345004', 'Клиника эстетической стоматологии'],
        ['Белая Жемчужина', 'belaya-zhemchuzhina', 'ул. Мукими, 33', 'Ташкент', 'Шайхантахурский', '+998712345005', 'Ортодонтия и имплантация мирового уровня'],
        ['DentaPro', 'dentapro', 'ул. Катартал, 8', 'Ташкент', 'Сергелийский', '+998712345006', 'Доступная стоматология без компромиссов'],
        ['Ivory Dental', 'ivory-dental', 'ул. Шота Руставели, 56', 'Ташкент', 'Мирабадский', '+998712345007', 'Клиника хирургической стоматологии'],
        ['MegaDent', 'megadent', 'пр. Узбекистанский, 101', 'Ташкент', 'Учтепинский', '+998712345008', 'Многопрофильный стоматологический центр'],
        ['ЕвроДент', 'evrodent', 'ул. Бобура, 12', 'Ташкент', 'Алмазарский', '+998712345009', 'Европейские стандарты стоматологии'],
        ['Нур Дент', 'nur-dent', 'ул. Регистан, 5', 'Самарканд', 'Центральный', '+998662345001', 'Лучшая стоматология Самарканда'],
        ['Бухоро Дент', 'buhoro-dent', 'ул. Накшбанди, 14', 'Бухара', 'Центральный', '+998652345001', 'Стоматологическая клиника в центре Бухары'],
        ['Стома Плюс', 'stoma-plus', 'ул. Мустакиллик, 27', 'Наманган', 'Центральный', '+998692345001', 'Современная стоматология в Намангане'],
        ['Dental Art', 'dental-art', 'ул. Ислома Каримова, 88', 'Ташкент', 'Яшнабадский', '+998712345010', 'Художественная реставрация и виниры'],
        ['SmileCare', 'smilecare', 'ул. Чулон, 15', 'Ташкент', 'Олмазорский', '+998712345011', 'Забота о вашей улыбке с 2018 года'],
        ['Dr. Tooth', 'dr-tooth', 'ул. Ойбек, 42', 'Ташкент', 'Юнусабадский', '+998712345012', 'Детская и взрослая стоматология'],
        ['Андижон Дент', 'andijon-dent', 'ул. Бобур, 7', 'Андижан', 'Центральный', '+998742345001', 'Стоматология для всей семьи в Андижане'],
        ['VIP Dental', 'vip-dental', 'ул. Лабзак, 31', 'Ташкент', 'Юнусабадский', '+998712345013', 'VIP-обслуживание в стоматологии'],
        ['Happy Smile', 'happy-smile', 'ул. Бабура, 66', 'Ташкент', 'Мирзо-Улугбекский', '+998712345014', 'Безболезненная стоматология'],
        ['Fergana Dental', 'fergana-dental', 'ул. Мустакиллик, 45', 'Фергана', 'Центральный', '+998732345001', 'Первая частная стоматология Ферганы'],
        ['Crystal Dent', 'crystal-dent', 'ул. Афросиаб, 19', 'Самарканд', 'Центральный', '+998662345002', 'Стоматология с прозрачными ценами']
    ];
    rec TEXT[];
BEGIN
    FOREACH rec SLICE 1 IN ARRAY clinic_data LOOP
        INSERT INTO clinics (name, slug, description, phone, address, city, district, country, owner_id, is_verified, is_active, subscription_plan, rating, review_count)
        VALUES (rec[1], rec[2], rec[7], rec[6], rec[3], rec[4], rec[5], 'UZ', admin_id, true, true,
                CASE WHEN random() > 0.5 THEN 'PRO' ELSE 'FREE' END,
                round((3.5 + random() * 1.5)::numeric, 2),
                floor(random() * 50 + 5)::int)
        ON CONFLICT (slug) DO NOTHING;
    END LOOP;
END $$;

-- ── 50 Doctors (realistic Uzbek names) ──────────────────────

DO $$
DECLARE
    first_names TEXT[] := ARRAY['Алишер','Бахтиёр','Дильшод','Жамшид','Камол','Лазиз','Мирзо','Нодир','Отабек','Рустам','Сардор','Тимур','Улугбек','Фаррух','Хуршид','Шерзод','Акбар','Бобур','Искандер','Достон','Анвар','Собир','Муроджон','Зафар','Абдулла','Мадина','Нилуфар','Гулнора','Дилором','Зулфия','Нигора','Саида','Фарида','Хилола','Шахло','Азиза','Барно','Дилноза','Зухра','Камола','Лола','Мунира','Насиба','Озода','Парвина','Рано','Сурайё','Тахмина','Умида','Ясмин'];
    last_names TEXT[] := ARRAY['Каримов','Рахимов','Нурматов','Юлдашев','Исмоилов','Хамидов','Мирзаев','Ташпулатов','Ибрагимов','Усманов','Жумаев','Бердиев','Турсунов','Халилов','Садыков','Маматов','Абдуллаев','Назаров','Шарипов','Файзуллаев','Рашидов','Султанов','Кодиров','Акрамов','Бахромов','Каримова','Рахимова','Нурматова','Юлдашева','Исмоилова','Хамидова','Мирзаева','Ташпулатова','Ибрагимова','Усманова','Жумаева','Бердиева','Турсунова','Халилова','Садыкова','Маматова','Абдуллаева','Назарова','Шарипова','Файзуллаева','Рашидова','Султанова','Кодирова','Акрамова','Бахромова'];
    specialties TEXT[] := ARRAY['Терапевт','Ортодонт','Хирург','Ортопед','Пародонтолог','Детский стоматолог','Имплантолог','Эндодонтист'];
    bios TEXT[] := ARRAY[
        'Опытный специалист с многолетним стажем работы в ведущих клиниках.',
        'Прошёл стажировку в Турции и Южной Корее. Владеет передовыми методиками.',
        'Специализируется на сложных случаях. Постоянный участник международных конференций.',
        'Выпускник Ташкентского медицинского института. Автор научных публикаций.',
        'Ведёт практику с фокусом на безболезненном лечении и комфорте пациента.',
        'Сертифицированный специалист. Регулярно повышает квалификацию.',
        'Известен индивидуальным подходом к каждому пациенту и высоким качеством работы.',
        'Работает с самыми современными материалами и оборудованием.'
    ];
    clinic_ids UUID[];
    i INT;
    user_id UUID;
    doctor_id UUID;
    spec TEXT;
    clinic_id UUID;
    exp_years INT;
    price NUMERIC;
    rating_val NUMERIC;
BEGIN
    -- Get all clinic IDs
    SELECT array_agg(id) INTO clinic_ids FROM clinics WHERE is_active = true;

    FOR i IN 1..50 LOOP
        user_id := gen_random_uuid();
        doctor_id := gen_random_uuid();
        spec := specialties[1 + floor(random() * array_length(specialties, 1))::int];
        clinic_id := clinic_ids[1 + floor(random() * array_length(clinic_ids, 1))::int];
        exp_years := 2 + floor(random() * 25)::int;
        price := (50 + floor(random() * 450)) * 1000;
        rating_val := round((3.5 + random() * 1.5)::numeric, 2);

        -- Create user
        INSERT INTO users (id, phone, first_name, last_name, is_active, is_verified, language, country)
        VALUES (
            user_id,
            '+99890' || lpad((1000000 + i * 13337)::text, 7, '0'),
            first_names[i],
            last_names[i],
            true, true, 'ru', 'UZ'
        ) ON CONFLICT DO NOTHING;

        -- Assign DOCTOR role
        INSERT INTO user_roles (user_id, role)
        VALUES (user_id, 'DOCTOR')
        ON CONFLICT (user_id, role, clinic_id) DO NOTHING;

        -- Create doctor profile
        INSERT INTO doctors (id, user_id, bio, experience_years, consultation_price, is_verified, rating, review_count, specialty, clinic_id, subscription_plan, verified, price_from)
        VALUES (
            doctor_id, user_id,
            bios[1 + floor(random() * array_length(bios, 1))::int],
            exp_years, price, true,
            rating_val,
            floor(random() * 80 + 3)::int,
            spec, clinic_id, 'FREE',
            true, price
        ) ON CONFLICT (user_id) DO NOTHING;

        -- Affiliation
        INSERT INTO doctor_clinic_affiliations (doctor_id, clinic_id, cooperation_type, is_active)
        VALUES (doctor_id, clinic_id, 'STAFF_DOCTOR', true)
        ON CONFLICT (doctor_id, clinic_id) DO NOTHING;
    END LOOP;
END $$;

-- ── Services for all clinics ────────────────────────────���───

INSERT INTO services (clinic_id, name_ru, name_uz, category, price, duration, is_active)
SELECT
    c.id,
    s.name_ru,
    s.name_uz,
    s.category,
    s.price + floor(random() * 50000)::int,  -- slight price variation per clinic
    s.duration,
    true
FROM clinics c
CROSS JOIN (VALUES
    ('Консультация', 'Konsultatsiya', 'Диагностика', 50000, 30),
    ('Лечение кариеса', 'Kariyes davolash', 'Лечение', 200000, 45),
    ('Профессиональная чистка', 'Professional tozalash', 'Гигиена', 150000, 60),
    ('Удаление зуба', 'Tish olish', 'Хирургия', 150000, 30),
    ('Отбеливание', 'Oqartirish', 'Эстетика', 500000, 90)
) AS s(name_ru, name_uz, category, price, duration)
WHERE c.is_active = true
ON CONFLICT DO NOTHING;

-- ── Summary ───────────────────���─────────────────────────────
SELECT 'Clinics: ' || count(*) FROM clinics WHERE is_active = true
UNION ALL
SELECT 'Doctors: ' || count(*) FROM doctors WHERE is_verified = true
UNION ALL
SELECT 'Services: ' || count(*) FROM services WHERE is_active = true
UNION ALL
SELECT 'Users: ' || count(*) FROM users;
