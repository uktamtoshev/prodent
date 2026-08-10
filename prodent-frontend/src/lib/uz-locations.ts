/**
 * Uzbekistan administrative divisions: regions (viloyatlar) + districts (tumanlar).
 * Source: synced with `regions` and `districts` tables in DB. Hardcoded copy here so
 * the cascading select doesn't require a backend round-trip.
 *
 * Use the `code` field as the canonical identifier. Display in Russian (name_ru) or
 * Uzbek (name_uz) depending on the active language.
 */

export interface Region {
  code: string;
  name_ru: string;
  name_uz: string;
  sort_order: number;
}

export interface District {
  code: string;
  region_code: string;
  name_ru: string;
  name_uz: string;
  sort_order: number;
}

export const REGIONS: Region[] = [
  { code: "TASHKENT_CITY", name_ru: "г. Ташкент", name_uz: "Toshkent shahri", sort_order: 1 },
  { code: "TASHKENT", name_ru: "Ташкентская область", name_uz: "Toshkent viloyati", sort_order: 2 },
  { code: "SAMARKAND", name_ru: "Самаркандская область", name_uz: "Samarqand viloyati", sort_order: 3 },
  { code: "BUKHARA", name_ru: "Бухарская область", name_uz: "Buxoro viloyati", sort_order: 4 },
  { code: "FERGANA", name_ru: "Ферганская область", name_uz: "Farg'ona viloyati", sort_order: 5 },
  { code: "NAMANGAN", name_ru: "Наманганская область", name_uz: "Namangan viloyati", sort_order: 6 },
  { code: "ANDIJAN", name_ru: "Андижанская область", name_uz: "Andijon viloyati", sort_order: 7 },
  { code: "JIZZAKH", name_ru: "Джизакская область", name_uz: "Jizzax viloyati", sort_order: 8 },
  { code: "NAVOI", name_ru: "Навоийская область", name_uz: "Navoiy viloyati", sort_order: 9 },
  { code: "KASHKADARYA", name_ru: "Кашкадарьинская область", name_uz: "Qashqadaryo viloyati", sort_order: 10 },
  { code: "SURKHANDARYA", name_ru: "Сурхандарьинская область", name_uz: "Surxondaryo viloyati", sort_order: 11 },
  { code: "SYRDARYA", name_ru: "Сырдарьинская область", name_uz: "Sirdaryo viloyati", sort_order: 12 },
  { code: "KHOREZM", name_ru: "Хорезмская область", name_uz: "Xorazm viloyati", sort_order: 13 },
  { code: "KARAKALPAKSTAN", name_ru: "Республика Каракалпакстан", name_uz: "Qoraqalpog'iston Respublikasi", sort_order: 14 },
];

const D = (region_code: string, code: string, name_ru: string, name_uz: string, sort_order: number): District => ({
  code, region_code, name_ru, name_uz, sort_order,
});

export const DISTRICTS: District[] = [
  // ────── Ташкент город ──────
  D("TASHKENT_CITY", "TC_BEKTEMIR", "Бектемирский", "Bektemir tumani", 1),
  D("TASHKENT_CITY", "TC_CHILANZAR", "Чиланзарский", "Chilonzor tumani", 2),
  D("TASHKENT_CITY", "TC_MIRABAD", "Мирабадский", "Mirobod tumani", 3),
  D("TASHKENT_CITY", "TC_MIRZO_ULUGBEK", "Мирзо-Улугбекский", "Mirzo Ulug'bek tumani", 4),
  D("TASHKENT_CITY", "TC_OLMAZAR", "Олмазарский", "Olmazor tumani", 5),
  D("TASHKENT_CITY", "TC_SERGELI", "Сергелийский", "Sergeli tumani", 6),
  D("TASHKENT_CITY", "TC_SHAYKHANTAUR", "Шайхантахурский", "Shayxontohur tumani", 7),
  D("TASHKENT_CITY", "TC_UCHTEPA", "Учтепинский", "Uchtepa tumani", 8),
  D("TASHKENT_CITY", "TC_YAKKASARAY", "Яккасарайский", "Yakkasaroy tumani", 9),
  D("TASHKENT_CITY", "TC_YASHNABAD", "Яшнабадский", "Yashnobod tumani", 10),
  D("TASHKENT_CITY", "TC_YUNUSABAD", "Юнусабадский", "Yunusobod tumani", 11),
  D("TASHKENT_CITY", "TC_YANGIHAYOT", "Янгихаётский", "Yangihayot tumani", 12),

  // ────── Ташкентская область ──────
  D("TASHKENT", "TR_AHANGARAN", "Ахангаранский", "Ohangaron tumani", 1),
  D("TASHKENT", "TR_BEKABAD", "Бекабадский", "Bekobod tumani", 2),
  D("TASHKENT", "TR_BOSTANLIQ", "Бостанлыкский", "Bo'stonliq tumani", 3),
  D("TASHKENT", "TR_BO_KA", "Букинский", "Bo'ka tumani", 4),
  D("TASHKENT", "TR_CHINAZ", "Чиназский", "Chinoz tumani", 5),
  D("TASHKENT", "TR_KIBRAY", "Кибрайский", "Qibray tumani", 6),
  D("TASHKENT", "TR_OQQO_RG_ON", "Аккурганский", "Oqqo'rg'on tumani", 7),
  D("TASHKENT", "TR_PARKENT", "Паркентский", "Parkent tumani", 8),
  D("TASHKENT", "TR_PISKENT", "Пскентский", "Piskent tumani", 9),
  D("TASHKENT", "TR_QUYI_CHIRCHIQ", "Куйичирчикский", "Quyi Chirchiq tumani", 10),
  D("TASHKENT", "TR_O_RTACHIRCHIQ", "Уртачирчикский", "O'rta Chirchiq tumani", 11),
  D("TASHKENT", "TR_YANGIYO_L", "Янгиюльский", "Yangiyo'l tumani", 12),
  D("TASHKENT", "TR_YUQORI_CHIRCHIQ", "Юкоричирчикский", "Yuqori Chirchiq tumani", 13),
  D("TASHKENT", "TR_ZANGIOTA", "Зангиатинский", "Zangiota tumani", 14),

  // ────── Самарканд ──────
  D("SAMARKAND", "SR_SAMARKAND_CITY", "г. Самарканд", "Samarqand shahri", 1),
  D("SAMARKAND", "SR_BULUNGUR", "Булунгурский", "Bulung'ur tumani", 2),
  D("SAMARKAND", "SR_OQDARYO", "Акдарьинский", "Oqdaryo tumani", 3),
  D("SAMARKAND", "SR_ISHTIXON", "Иштыханский", "Ishtixon tumani", 4),
  D("SAMARKAND", "SR_JOMBOY", "Джамбайский", "Jomboy tumani", 5),
  D("SAMARKAND", "SR_KATTAQO_RG_ON", "Каттакурганский", "Kattaqo'rg'on tumani", 6),
  D("SAMARKAND", "SR_NARPAY", "Нарпайский", "Narpay tumani", 7),
  D("SAMARKAND", "SR_NUROBOD", "Нурабадский", "Nurobod tumani", 8),
  D("SAMARKAND", "SR_OQTOSH", "Актошский", "Oqtosh tumani", 9),
  D("SAMARKAND", "SR_PASTDARG_OM", "Пастдаргомский", "Pastdarg'om tumani", 10),
  D("SAMARKAND", "SR_PAYARIQ", "Паярыкский", "Payariq tumani", 11),
  D("SAMARKAND", "SR_PAXTACHI", "Пахтачинский", "Paxtachi tumani", 12),
  D("SAMARKAND", "SR_QO_SHRABOT", "Кошрабатский", "Qo'shrabot tumani", 13),
  D("SAMARKAND", "SR_SAMARKAND", "Самаркандский", "Samarqand tumani", 14),
  D("SAMARKAND", "SR_TAYLOQ", "Тайлакский", "Tayloq tumani", 15),
  D("SAMARKAND", "SR_URGUT", "Ургутский", "Urgut tumani", 16),

  // ────── Бухара ──────
  D("BUKHARA", "BR_BUKHARA_CITY", "г. Бухара", "Buxoro shahri", 1),
  D("BUKHARA", "BR_BUKHARA", "Бухарский", "Buxoro tumani", 2),
  D("BUKHARA", "BR_OLOT", "Алатский", "Olot tumani", 3),
  D("BUKHARA", "BR_GIJDUVON", "Гиждуванский", "Gijduvon tumani", 4),
  D("BUKHARA", "BR_JONDOR", "Джондорский", "Jondor tumani", 5),
  D("BUKHARA", "BR_KOGON", "Каганский", "Kogon tumani", 6),
  D("BUKHARA", "BR_QORAKO_L", "Каракульский", "Qorako'l tumani", 7),
  D("BUKHARA", "BR_QOROVULBOZOR", "Караулбазарский", "Qorovulbozor tumani", 8),
  D("BUKHARA", "BR_PESHKU", "Пешкунский", "Peshku tumani", 9),
  D("BUKHARA", "BR_ROMITAN", "Ромитанский", "Romitan tumani", 10),
  D("BUKHARA", "BR_SHOFIRKON", "Шафирканский", "Shofirkon tumani", 11),
  D("BUKHARA", "BR_VOBKENT", "Вабкентский", "Vobkent tumani", 12),

  // ────── Фергана ──────
  D("FERGANA", "FR_FERGANA_CITY", "г. Фергана", "Farg'ona shahri", 1),
  D("FERGANA", "FR_QO_QON_CITY", "г. Коканд", "Qo'qon shahri", 2),
  D("FERGANA", "FR_MARG_ILON", "г. Маргилан", "Marg'ilon shahri", 3),
  D("FERGANA", "FR_OLTIARIQ", "Алтыарыкский", "Oltiariq tumani", 4),
  D("FERGANA", "FR_BAG_DOD", "Багдадский", "Bag'dod tumani", 5),
  D("FERGANA", "FR_BESHARIQ", "Бешарыкский", "Beshariq tumani", 6),
  D("FERGANA", "FR_BUVAYDA", "Бувайдинский", "Buvayda tumani", 7),
  D("FERGANA", "FR_DANG_ARA", "Дангаринский", "Dang'ara tumani", 8),
  D("FERGANA", "FR_FARG_ONA", "Ферганский", "Farg'ona tumani", 9),
  D("FERGANA", "FR_FURQAT", "Фуркатский", "Furqat tumani", 10),
  D("FERGANA", "FR_QO_SHTEPA", "Куштепинский", "Qo'shtepa tumani", 11),
  D("FERGANA", "FR_QUVA", "Кувинский", "Quva tumani", 12),
  D("FERGANA", "FR_QUVASOY", "Кувасайский", "Quvasoy tumani", 13),
  D("FERGANA", "FR_RISHTON", "Риштанский", "Rishton tumani", 14),
  D("FERGANA", "FR_SO_X", "Сохский", "So'x tumani", 15),
  D("FERGANA", "FR_TOSHLOQ", "Ташлакский", "Toshloq tumani", 16),
  D("FERGANA", "FR_UCHKO_PRIK", "Учкуприкский", "Uchko'prik tumani", 17),
  D("FERGANA", "FR_O_ZBEKISTON", "Узбекистанский", "O'zbekiston tumani", 18),
  D("FERGANA", "FR_YOZYOVON", "Язъяванский", "Yozyovon tumani", 19),

  // ────── Андижан ──────
  D("ANDIJAN", "AR_ANDIJAN_CITY", "г. Андижан", "Andijon shahri", 1),
  D("ANDIJAN", "AR_ANDIJON", "Андижанский", "Andijon tumani", 2),
  D("ANDIJAN", "AR_ASAKA", "Асакинский", "Asaka tumani", 3),
  D("ANDIJAN", "AR_BALIQCHI", "Балыкчинский", "Baliqchi tumani", 4),
  D("ANDIJAN", "AR_BO_STON", "Бустанский", "Bo'ston tumani", 5),
  D("ANDIJAN", "AR_BO_Z", "Бузский", "Bo'z tumani", 6),
  D("ANDIJAN", "AR_IZBOSKAN", "Избасканский", "Izboskan tumani", 7),
  D("ANDIJAN", "AR_JALAQUDUQ", "Джалакудукский", "Jalaquduq tumani", 8),
  D("ANDIJAN", "AR_XO_JAOBOD", "Ходжаабадский", "Xo'jaobod tumani", 9),
  D("ANDIJAN", "AR_QO_RG_ONTEPA", "Кургантепинский", "Qo'rg'ontepa tumani", 10),
  D("ANDIJAN", "AR_MARHAMAT", "Мархаматский", "Marhamat tumani", 11),
  D("ANDIJAN", "AR_OLTINKO_L", "Алтынкульский", "Oltinko'l tumani", 12),
  D("ANDIJAN", "AR_PAXTAOBOD", "Пахтаабадский", "Paxtaobod tumani", 13),
  D("ANDIJAN", "AR_SHAHRIXON", "Шахриханский", "Shahrixon tumani", 14),
  D("ANDIJAN", "AR_ULUG_NOR", "Улугнарский", "Ulug'nor tumani", 15),

  // ────── Наманган ──────
  D("NAMANGAN", "NR_NAMANGAN_CITY", "г. Наманган", "Namangan shahri", 1),
  D("NAMANGAN", "NR_NAMANGAN", "Наманганский", "Namangan tumani", 2),
  D("NAMANGAN", "NR_CHORTOQ", "Чартакский", "Chortoq tumani", 3),
  D("NAMANGAN", "NR_CHUST", "Чустский", "Chust tumani", 4),
  D("NAMANGAN", "NR_KOSONSOY", "Касансайский", "Kosonsoy tumani", 5),
  D("NAMANGAN", "NR_MINGBULOQ", "Мингбулакский", "Mingbuloq tumani", 6),
  D("NAMANGAN", "NR_NORIN", "Наринский", "Norin tumani", 7),
  D("NAMANGAN", "NR_POP", "Папский", "Pop tumani", 8),
  D("NAMANGAN", "NR_TO_RAQO_RG_ON", "Тураккурганский", "To'raqo'rg'on tumani", 9),
  D("NAMANGAN", "NR_UCHQO_RG_ON", "Учкурганский", "Uchqo'rg'on tumani", 10),
  D("NAMANGAN", "NR_YANGIQO_RG_ON", "Янгикурганский", "Yangiqo'rg'on tumani", 11),

  // ────── Джизак ──────
  D("JIZZAKH", "JR_JIZZAX_CITY", "г. Джизак", "Jizzax shahri", 1),
  D("JIZZAKH", "JR_ARNASOY", "Арнасайский", "Arnasoy tumani", 2),
  D("JIZZAKH", "JR_BAXMAL", "Бахмальский", "Baxmal tumani", 3),
  D("JIZZAKH", "JR_DO_STLIK", "Дустликский", "Do'stlik tumani", 4),
  D("JIZZAKH", "JR_FORISH", "Фаришский", "Forish tumani", 5),
  D("JIZZAKH", "JR_G_ALLAOROL", "Галляаральский", "G'allaorol tumani", 6),
  D("JIZZAKH", "JR_JIZZAX", "Джизакский", "Jizzax tumani", 7),
  D("JIZZAKH", "JR_MIRZACHO_L", "Мирзачульский", "Mirzacho'l tumani", 8),
  D("JIZZAKH", "JR_PAXTAKOR", "Пахтакорский", "Paxtakor tumani", 9),
  D("JIZZAKH", "JR_YANGIOBOD", "Янгиабадский", "Yangiobod tumani", 10),
  D("JIZZAKH", "JR_ZAFAROBOD", "Зафарабадский", "Zafarobod tumani", 11),
  D("JIZZAKH", "JR_ZARBDOR", "Зарбдорский", "Zarbdor tumani", 12),
  D("JIZZAKH", "JR_ZOMIN", "Зааминский", "Zomin tumani", 13),

  // ────── Навои ──────
  D("NAVOI", "NV_NAVOIY_CITY", "г. Навои", "Navoiy shahri", 1),
  D("NAVOI", "NV_KARMANA", "Карманинский", "Karmana tumani", 2),
  D("NAVOI", "NV_KONIMEX", "Канимехский", "Konimex tumani", 3),
  D("NAVOI", "NV_NAVBAHOR", "Навбахорский", "Navbahor tumani", 4),
  D("NAVOI", "NV_NURATA", "Нуратинский", "Nurota tumani", 5),
  D("NAVOI", "NV_QIZILTEPA", "Кызылтепинский", "Qiziltepa tumani", 6),
  D("NAVOI", "NV_TOMDI", "Томдинский", "Tomdi tumani", 7),
  D("NAVOI", "NV_UCHQUDUQ", "Учкудукский", "Uchquduq tumani", 8),
  D("NAVOI", "NV_XATIRCHI", "Хатырчинский", "Xatirchi tumani", 9),
  D("NAVOI", "NV_ZARAFSHON", "Зарафшанский", "Zarafshon tumani", 10),

  // ────── Кашкадарья ──────
  D("KASHKADARYA", "KR_QARSHI_CITY", "г. Карши", "Qarshi shahri", 1),
  D("KASHKADARYA", "KR_QARSHI", "Каршинский", "Qarshi tumani", 2),
  D("KASHKADARYA", "KR_CHIROQCHI", "Чиракчинский", "Chiroqchi tumani", 3),
  D("KASHKADARYA", "KR_DEXQONOBOD", "Дехканабадский", "Dehqonobod tumani", 4),
  D("KASHKADARYA", "KR_G_UZOR", "Гузарский", "G'uzor tumani", 5),
  D("KASHKADARYA", "KR_QAMASHI", "Камашинский", "Qamashi tumani", 6),
  D("KASHKADARYA", "KR_QASBI", "Касбинский", "Qasbi tumani", 7),
  D("KASHKADARYA", "KR_KITOB", "Китабский", "Kitob tumani", 8),
  D("KASHKADARYA", "KR_KO_KDALA", "Кокдалинский", "Ko'kdala tumani", 9),
  D("KASHKADARYA", "KR_MIRISHKOR", "Миришкорский", "Mirishkor tumani", 10),
  D("KASHKADARYA", "KR_MUBORAK", "Мубарекский", "Muborak tumani", 11),
  D("KASHKADARYA", "KR_NISHON", "Нишанский", "Nishon tumani", 12),
  D("KASHKADARYA", "KR_SHAHRISABZ", "Шахрисабзский", "Shahrisabz tumani", 13),
  D("KASHKADARYA", "KR_YAKKABOG", "Яккабагский", "Yakkabog tumani", 14),

  // ────── Сурхандарья ──────
  D("SURKHANDARYA", "SD_TERMIZ_CITY", "г. Термез", "Termiz shahri", 1),
  D("SURKHANDARYA", "SD_ANGOR", "Ангорский", "Angor tumani", 2),
  D("SURKHANDARYA", "SD_BANDIXON", "Бандиханский", "Bandixon tumani", 3),
  D("SURKHANDARYA", "SD_BOYSUN", "Байсунский", "Boysun tumani", 4),
  D("SURKHANDARYA", "SD_DENOV", "Денауский", "Denov tumani", 5),
  D("SURKHANDARYA", "SD_JARQO_RG_ON", "Джаркурганский", "Jarqo'rg'on tumani", 6),
  D("SURKHANDARYA", "SD_QIZIRIQ", "Кизирикский", "Qiziriq tumani", 7),
  D("SURKHANDARYA", "SD_QUMQO_RG_ON", "Кумкурганский", "Qumqo'rg'on tumani", 8),
  D("SURKHANDARYA", "SD_MUZRABOT", "Музрабатский", "Muzrabot tumani", 9),
  D("SURKHANDARYA", "SD_OLTINSOY", "Алтынсайский", "Oltinsoy tumani", 10),
  D("SURKHANDARYA", "SD_SARIOSIYO", "Сариасийский", "Sariosiyo tumani", 11),
  D("SURKHANDARYA", "SD_SHO_RCHI", "Шурчинский", "Sho'rchi tumani", 12),
  D("SURKHANDARYA", "SD_SHERABOD", "Шерабадский", "Sherobod tumani", 13),
  D("SURKHANDARYA", "SD_TERMIZ", "Термезский", "Termiz tumani", 14),
  D("SURKHANDARYA", "SD_UZUN", "Узунский", "Uzun tumani", 15),

  // ────── Сырдарья ──────
  D("SYRDARYA", "SY_GULISTON_CITY", "г. Гулистан", "Guliston shahri", 1),
  D("SYRDARYA", "SY_AKALTYN", "Акалтынский", "Oqoltin tumani", 2),
  D("SYRDARYA", "SY_BOYOVUT", "Баяутский", "Boyovut tumani", 3),
  D("SYRDARYA", "SY_GULISTON", "Гулистанский", "Guliston tumani", 4),
  D("SYRDARYA", "SY_MIRZAOBOD", "Мирзаабадский", "Mirzaobod tumani", 5),
  D("SYRDARYA", "SY_SAYXUNOBOD", "Сайхунабадский", "Sayxunobod tumani", 6),
  D("SYRDARYA", "SY_SARDOBA", "Сардобинский", "Sardoba tumani", 7),
  D("SYRDARYA", "SY_SIRDARYO", "Сырдарьинский", "Sirdaryo tumani", 8),
  D("SYRDARYA", "SY_XOVOS", "Хавастский", "Xovos tumani", 9),
  D("SYRDARYA", "SY_YANGIYER", "Янгиерский", "Yangiyer tumani", 10),

  // ────── Хорезм ──────
  D("KHOREZM", "KH_URGANCH_CITY", "г. Ургенч", "Urganch shahri", 1),
  D("KHOREZM", "KH_BOG_OT", "Багатский", "Bog'ot tumani", 2),
  D("KHOREZM", "KH_GURLAN", "Гурленский", "Gurlan tumani", 3),
  D("KHOREZM", "KH_QO_SHKO_PIR", "Кошкупырский", "Qo'shko'pir tumani", 4),
  D("KHOREZM", "KH_HAZORASP", "Хазараспский", "Hazorasp tumani", 5),
  D("KHOREZM", "KH_XIVA", "Хивинский", "Xiva tumani", 6),
  D("KHOREZM", "KH_XONQA", "Ханкинский", "Xonqa tumani", 7),
  D("KHOREZM", "KH_SHOVOT", "Шаватский", "Shovot tumani", 8),
  D("KHOREZM", "KH_URGANCH", "Ургенчский", "Urganch tumani", 9),
  D("KHOREZM", "KH_YANGIARIQ", "Янгиарыкский", "Yangiariq tumani", 10),
  D("KHOREZM", "KH_YANGIBOZOR", "Янгибазарский", "Yangibozor tumani", 11),
  D("KHOREZM", "KH_TUPROQQAL_A", "Тупраккалинский", "Tuproqqal'a tumani", 12),

  // ────── Каракалпакстан ──────
  D("KARAKALPAKSTAN", "QQ_NUKUS_CITY", "г. Нукус", "Nukus shahri", 1),
  D("KARAKALPAKSTAN", "QQ_AMUDARYO", "Амударьинский", "Amudaryo tumani", 2),
  D("KARAKALPAKSTAN", "QQ_BERUNIY", "Берунийский", "Beruniy tumani", 3),
  D("KARAKALPAKSTAN", "QQ_CHIMBOY", "Чимбайский", "Chimboy tumani", 4),
  D("KARAKALPAKSTAN", "QQ_ELLIKQAL_A", "Элликкалинский", "Ellikqal'a tumani", 5),
  D("KARAKALPAKSTAN", "QQ_KEGEYLI", "Кегейлийский", "Kegeyli tumani", 6),
  D("KARAKALPAKSTAN", "QQ_QONG_IROT", "Кунградский", "Qo'ng'irot tumani", 7),
  D("KARAKALPAKSTAN", "QQ_QORAO_ZAK", "Караузякский", "Qorao'zak tumani", 8),
  D("KARAKALPAKSTAN", "QQ_MO_YNOQ", "Муйнакский", "Mo'ynoq tumani", 9),
  D("KARAKALPAKSTAN", "QQ_NUKUS", "Нукусский", "Nukus tumani", 10),
  D("KARAKALPAKSTAN", "QQ_QANLIKO_L", "Канлыкульский", "Qanliko'l tumani", 11),
  D("KARAKALPAKSTAN", "QQ_SHUMANAY", "Шуманайский", "Shumanay tumani", 12),
  D("KARAKALPAKSTAN", "QQ_TAXIATOSH", "Тахиаташский", "Taxiatosh tumani", 13),
  D("KARAKALPAKSTAN", "QQ_TAXTAKO_PIR", "Тахтакупырский", "Taxtako'pir tumani", 14),
  D("KARAKALPAKSTAN", "QQ_TO_RTKO_L", "Турткульский", "To'rtko'l tumani", 15),
  D("KARAKALPAKSTAN", "QQ_XO_JAYLI", "Ходжейлийский", "Xo'jayli tumani", 16),
];

export const getDistrictsByRegion = (regionCode: string | null | undefined): District[] => {
  if (!regionCode) return [];
  return DISTRICTS.filter((d) => d.region_code === regionCode).sort(
    (a, b) => a.sort_order - b.sort_order
  );
};

export const getRegion = (code: string | null | undefined): Region | null =>
  REGIONS.find((r) => r.code === code) || null;

export const getDistrict = (code: string | null | undefined): District | null =>
  DISTRICTS.find((d) => d.code === code) || null;

export const regionLabel = (code: string | null | undefined, lang: "ru" | "uz" = "ru"): string => {
  const r = getRegion(code);
  if (!r) return "";
  return lang === "uz" ? r.name_uz : r.name_ru;
};

export const districtLabel = (code: string | null | undefined, lang: "ru" | "uz" = "ru"): string => {
  const d = getDistrict(code);
  if (!d) return "";
  return lang === "uz" ? d.name_uz : d.name_ru;
};
