/**
 * Helper utilities for seeding test data
 * 
 * IMPORTANT: These are helper functions, actual data insertion
 * must be done via Supabase because profiles require auth.users
 */

export interface TestDoctor {
  specialty: string;
  experience_years: number;
  education: string;
  bio: string;
  price_from: number;
  certifications: string[];
}

export const TEST_DOCTORS: TestDoctor[] = [
  {
    specialty: "Ортодонт",
    experience_years: 15,
    education: "Ташкентский государственный медицинский институт, 2008",
    bio: "Специализируюсь на исправлении прикуса и установке брекет-систем. Работаю с современными методиками Invisalign и Damon.",
    price_from: 500000,
    certifications: [
      "Сертификат ортодонта международного образца",
      "Invisalign сертификация",
      "Курс по системе Damon",
    ],
  },
  {
    specialty: "Имплантолог",
    experience_years: 12,
    education: "Самаркандский медицинский институт, 2011",
    bio: "Более 1000 успешных имплантаций. Использую швейцарские (Nobel Biocare) и немецкие (Straumann) имплантаты.",
    price_from: 700000,
    certifications: [
      "Имплантология и остеоинтеграция",
      "Хирургическая стоматология",
      "Nobel Biocare сертификация",
    ],
  },
  {
    specialty: "Терапевт",
    experience_years: 8,
    education: "Бухарский медицинский институт, 2015",
    bio: "Лечение кариеса, пульпита, периодонтита. Работаю с микроскопом для точного лечения каналов.",
    price_from: 400000,
    certifications: [
      "Эндодонтия",
      "Работа с дентальным микроскопом",
      "Эстетическая реставрация",
    ],
  },
  {
    specialty: "Хирург",
    experience_years: 20,
    education: "Ташкентский медицинский институт, 2003",
    bio: "Удаление зубов любой сложности, в том числе зубов мудрости. Синус-лифтинг и костная пластика.",
    price_from: 600000,
    certifications: [
      "Челюстно-лицевая хирургия",
      "Костная пластика",
      "Синус-лифтинг",
    ],
  },
  {
    specialty: "Детский стоматолог",
    experience_years: 10,
    education: "Андижанский медицинский институт, 2013",
    bio: "Работаю с детьми всех возрастов. Особый подход к маленьким пациентам, лечение без страха и боли.",
    price_from: 300000,
    certifications: [
      "Детская стоматология",
      "Психология работы с детьми",
      "Седация в детской стоматологии",
    ],
  },
  {
    specialty: "Пародонтолог",
    experience_years: 9,
    education: "Наманганский медицинский институт, 2014",
    bio: "Лечение десен, профессиональная чистка, лечение пародонтита и пародонтоза. Vector-терапия.",
    price_from: 450000,
    certifications: [
      "Пародонтология",
      "Vector-терапия",
      "Лазерная стоматология",
    ],
  },
];

export const TEST_SERVICES = [
  "Консультация",
  "Лечение кариеса",
  "Профессиональная чистка зубов",
  "Отбеливание зубов",
  "Установка брекетов",
  "Имплантация зубов",
  "Протезирование",
  "Удаление зуба",
  "Лечение пульпита",
  "Лечение пародонтита",
  "Установка виниров",
  "Костная пластика",
];

export const TEST_MEDIA_URLS = {
  beforeAfter: [
    "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800",
    "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800",
    "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=800",
    "https://images.unsplash.com/photo-1609840114035-3c981407e31f?w=800",
  ],
  clinic: [
    "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800",
    "https://images.unsplash.com/photo-1629909615957-be38f2ac4f58?w=800",
    "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=800",
  ],
  doctors: [
    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop",
  ],
};

/**
 * Generate sample review comments
 */
export const SAMPLE_REVIEWS = [
  {
    rating: 5,
    comment: "Отличный врач! Очень внимательный и профессиональный. Все объяснил, лечение прошло безболезненно.",
  },
  {
    rating: 5,
    comment: "Лучший специалист! Долго искала хорошего врача и наконец нашла. Рекомендую всем!",
  },
  {
    rating: 4,
    comment: "Хороший доктор, качественное лечение. Единственный минус - долго ждал своей очереди.",
  },
  {
    rating: 5,
    comment: "Прекрасный врач с золотыми руками! Лечил зуб под микроскопом, результат отличный!",
  },
  {
    rating: 5,
    comment: "Очень довольна! Боялась идти к стоматологу, но здесь все прошло комфортно и без боли.",
  },
  {
    rating: 4,
    comment: "Профессионал своего дела. Немного дороговато, но качество того стоит.",
  },
];
