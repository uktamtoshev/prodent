import { expect, test, type Page } from "@playwright/test";
import { resetRateLimits } from "./helpers/stand";
import { ACCOUNTS, QA_PASSWORD, type AccountKey } from "./helpers/clinic";
import { loginViaUi } from "./helpers/auth-ui";

/**
 * Обход всех страниц кабинетов вживую: клиника, маркетплейс, техник, админ.
 *
 * Волны 1-7 проверяют сценарии вглубь — «сделал и получил результат». Этот
 * набор идёт вширь: открывает каждую страницу роли и убеждается, что она
 * действительно работает, а не встречает пользователя пустотой или красным
 * «не удалось загрузить». Ровно так всплыл сломанный список счетов.
 */

/** Тексты, которыми продукт сообщает о поломке. */
const FAILURE_MARKERS = [
  "Не удалось",
  "не удалось",
  "Ошибка загрузки",
  "Something went wrong",
  "Произошла ошибка",
];

/** Путь, подпись и — если адрес намеренно ведёт дальше — куда именно. */
type PageEntry = [path: string, label: string, redirectsTo?: string];

interface Cabinet {
  role: AccountKey;
  home: RegExp;
  pages: PageEntry[];
}

const CABINETS: Cabinet[] = [
  {
    role: "clinicAdmin",
    home: /\/crm/,
    pages: [
      ["/crm", "рабочий стол"],
      ["/crm/schedule", "расписание"],
      ["/crm/calendar", "календарь"],
      // Записи слиты с расписанием, склад и лаборатория вынесены в свои модули —
      // старые адреса остались как переадресация, и это правильное поведение.
      ["/crm/appointments", "записи", "/crm/schedule"],
      ["/crm/queue", "очередь"],
      ["/crm/patients", "пациенты"],
      ["/crm/medical-records", "медкарты"],
      ["/crm/medical-access", "доступ к медданным"],
      ["/crm/treatment-plans", "планы лечения"],
      ["/crm/services", "услуги"],
      ["/crm/tasks", "задачи"],
      ["/crm/doctor-requests", "заявки врачей"],
      ["/crm/invitations", "приглашения"],
      ["/crm/finance", "финансы"],
      ["/crm/billing", "счета"],
      ["/crm/balance", "баланс"],
      ["/crm/reports", "отчёты"],
      ["/crm/inventory", "склад", "/sklad"],
      ["/crm/laboratory", "лаборатория", "/lab"],
      ["/crm/messages", "сообщения"],
      ["/crm/notifications", "уведомления"],
      ["/crm/profile", "профиль клиники"],
      ["/crm/settings", "настройки"],
      ["/clinic-admin/schedule", "расписание отдельного кабинета клиники"],
      ["/clinic-admin/appointments", "записи отдельного кабинета клиники"],
      ["/clinic-admin/patients", "пациенты отдельного кабинета клиники"],
      ["/clinic-admin/messages", "сообщения отдельного кабинета клиники"],
      ["/clinic-admin/payments", "платежи отдельного кабинета клиники"],
      ["/clinic-admin/promotions", "акции отдельного кабинета клиники"],
      ["/clinic-admin/notifications", "уведомления отдельного кабинета клиники"],
      ["/clinic-admin/settings", "настройки отдельного кабинета клиники"],
    ],
  },
  {
    role: "patient",
    home: /\/patient/,
    pages: [
      ["/patient", "главная пациента"],
      ["/patient/dashboard", "дашборд пациента"],
      ["/patient/appointments", "записи пациента"],
      ["/patient/book", "запись к врачу"],
      ["/patient/history", "история посещений"],
      ["/patient/reminders", "напоминания"],
      ["/patient/notifications", "уведомления пациента"],
      ["/patient/my-doctors", "врачи пациента"],
      ["/patient/billing", "платежи пациента"],
      ["/patient/medical", "медицинские данные пациента"],
      ["/patient/access", "история доступа к медданным"],
      ["/patient/messages", "сообщения пациента"],
      ["/patient/files", "файлы пациента"],
      ["/patient/family", "семья пациента"],
    ],
  },
  {
    role: "doctor",
    home: /\/crm/,
    pages: [
      ["/doctor", "главная врача", "/doctor/calendar"],
      ["/doctor/calendar", "календарь врача"],
      ["/doctor/calendar/legacy", "старый календарь врача"],
      ["/doctor/patients", "пациенты врача"],
      ["/doctor/messages", "сообщения врача"],
      ["/doctor/notifications", "уведомления врача"],
      ["/doctor/medical-records", "медицинские карты врача"],
      ["/doctor/treatment-plans", "планы лечения врача"],
      ["/doctor/media", "медиатека врача"],
      ["/doctor/laboratory", "лаборатория врача", "/lab"],
      ["/doctor/balance", "баланс врача"],
      ["/doctor/billing", "подписка врача"],
      ["/doctor/warehouse", "склад врача", "/sklad"],
      ["/doctor/market", "маркет врача", "/market"],
    ],
  },
  {
    role: "assistant",
    home: /\/assistant\/schedule/,
    pages: [
      ["/assistant/schedule", "расписание ассистента"],
      ["/assistant/rooms", "кабинеты ассистента"],
      ["/assistant/materials", "материалы ассистента"],
      ["/assistant/appointments", "записи ассистента"],
    ],
  },
  {
    role: "accountant",
    home: /\/accountant\/invoices/,
    pages: [
      ["/accountant/invoices", "счета бухгалтера"],
      ["/accountant/payments", "платежи бухгалтера"],
      ["/accountant/reports", "отчёты бухгалтера"],
      ["/accountant/salaries", "зарплаты бухгалтера"],
    ],
  },
  {
    role: "clinicManager",
    home: /\/manager\/dashboard/,
    pages: [
      ["/manager/dashboard", "дашборд менеджера"],
      ["/manager/kpi", "KPI менеджера"],
      ["/manager/analytics", "аналитика менеджера"],
      ["/manager/staff", "сотрудники менеджера"],
      ["/manager/services", "услуги менеджера"],
    ],
  },
  {
    role: "moderator",
    home: /\/admin\/moderation/,
    pages: [
      ["/admin/moderation", "очередь модерации"],
      ["/admin/reviews", "модерация отзывов"],
      ["/admin/market/products", "модерация товаров"],
      ["/admin/market/reviews", "модерация отзывов маркетплейса"],
      ["/admin/market/disputes", "споры маркетплейса"],
    ],
  },
  {
    role: "seller",
    home: /\/seller/,
    pages: [
      ["/seller", "витрина продавца"],
      ["/seller/products", "товары"],
      ["/seller/orders", "заказы"],
      ["/seller/warehouse", "склад продавца"],
      ["/seller/finance", "финансы продавца"],
      ["/seller/promo", "продвижение"],
      ["/seller/reviews", "отзывы"],
      ["/seller/profile", "профиль продавца"],
      ["/seller/settings", "настройки продавца"],
    ],
  },
  {
    role: "technician",
    home: /\/technician/,
    pages: [
      ["/technician", "заказы техника"],
      ["/technician/production", "производство"],
      ["/technician/archive", "архив"],
      ["/technician/materials", "материалы"],
      ["/technician/finance", "финансы техника"],
      ["/technician/settlements", "взаиморасчёты"],
      ["/technician/messages", "сообщения техника"],
      ["/technician/profile", "профиль техника"],
    ],
  },
  {
    // Интеграции (ключи внешних сервисов) открыты только супер-админу — это
    // задумано, поэтому страница проверяется под ним, а не под админом.
    role: "superAdmin",
    home: /\/admin/,
    pages: [
      ["/admin/integrations", "интеграции"],
    ],
  },
  {
    role: "admin",
    home: /\/admin/,
    pages: [
      ["/admin", "панель администратора"],
      ["/admin/users", "пользователи"],
      ["/admin/doctors", "врачи"],
      ["/admin/clinics", "клиники"],
      ["/admin/patients", "пациенты"],
      ["/admin/appointments", "записи"],
      ["/admin/verification", "проверка заявок"],
      ["/admin/moderation", "модерация"],
      ["/admin/reviews", "отзывы"],
      ["/admin/blog", "блог"],
      ["/admin/promotions", "акции"],
      ["/admin/promo", "промокоды"],
      ["/admin/ads", "реклама"],
      ["/admin/badges", "значки"],
      ["/admin/broadcast", "рассылки"],
      ["/admin/payments", "платежи"],
      ["/admin/referrals", "рефералы"],
      ["/admin/settings", "настройки платформы"],
      ["/admin/lab", "лаборатория"],
      ["/admin/job-reports", "жалобы на вакансии"],
      ["/admin/market/products", "маркет: товары"],
      ["/admin/market/orders", "маркет: заказы"],
      ["/admin/market/sellers", "маркет: продавцы"],
      ["/admin/market/reviews", "маркет: отзывы"],
      ["/admin/market/disputes", "маркет: споры"],
    ],
  },
];

/** Витрина маркетплейса — общая для врача и клиники. */
const MARKET_PAGES: Array<[string, string]> = [
  ["/market", "каталог"],
  ["/market/cart", "корзина"],
  ["/market/orders", "мои заказы"],
];

async function openCabinet(page: Page, role: AccountKey, home: RegExp): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("language", "ru"));
  await loginViaUi(page, ACCOUNTS[role], QA_PASSWORD);
  await expect(page).toHaveURL(home, { timeout: 30_000 });
}

/**
 * Проверяет одну страницу и возвращает жалобу, если что-то не так.
 *
 * Тест не падает на первой же странице: обход идёт до конца, а список
 * проблемных страниц выдаётся разом — иначе каждая правка вскрывала бы ровно
 * одну поломку за прогон.
 */
async function inspectPage(
  page: Page,
  path: string,
  label: string,
  redirectsTo?: string,
): Promise<string | null> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
  } catch (error) {
    return `${label} (${path}): страница не открылась — ${(error as Error).message}`;
  }

  await page.waitForTimeout(2_000);

  const actual = new URL(page.url()).pathname;
  const expectedPath = redirectsTo ?? path;
  if (actual !== expectedPath) {
    return redirectsTo
      ? `${label} (${path}): переадресация ведёт на ${actual} вместо ${redirectsTo}`
      : `${label} (${path}): роль перекинуло на ${actual} — доступа нет`;
  }

  // Тяжёлые страницы (рабочий стол клиники) собираются дольше пары секунд —
  // ждём отрисовку, а не заглядываем однажды.
  const main = page.locator("main").first();
  try {
    await main.waitFor({ state: "visible", timeout: 20_000 });
  } catch {
    return `${label} (${path}): содержимое не отрисовалось`;
  }

  const text = ((await main.textContent()) ?? "").trim();
  if (!text) {
    return `${label} (${path}): страница пустая`;
  }

  const marker = FAILURE_MARKERS.find((candidate) => text.includes(candidate));
  if (marker) {
    return `${label} (${path}): сообщение об ошибке «${marker}»`;
  }

  return null;
}

test.beforeEach(() => {
  resetRateLimits();
});

for (const cabinet of CABINETS) {
  test(`Кабинет «${cabinet.role}»: перечисленные статические страницы роли открываются`, async ({ page }) => {
    test.setTimeout(300_000);
    await openCabinet(page, cabinet.role, cabinet.home);

    const problems: string[] = [];
    for (const [path, label, redirectsTo] of cabinet.pages) {
      const problem = await inspectPage(page, path, label, redirectsTo);
      if (problem) problems.push(problem);
    }

    expect(problems, `проблемные страницы кабинета ${cabinet.role}`).toEqual([]);
  });
}

test("Маркетплейс: витрина работает", async ({ page }) => {
  test.setTimeout(180_000);
  await openCabinet(page, "clinicAdmin", /\/crm/);

  const problems: string[] = [];
  for (const [path, label] of MARKET_PAGES) {
    const problem = await inspectPage(page, path, label);
    if (problem) problems.push(problem);
  }

  expect(problems, "проблемные страницы маркетплейса").toEqual([]);
});
