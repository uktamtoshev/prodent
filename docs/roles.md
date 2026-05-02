# PRODENT — Роли и права доступа

Канонический источник enum ролей: `prodent-backend/src/main/java/com/prodent/entity/UserRole.java` (`AppRole`).
В БД роль хранится в `user_roles.role` (`VARCHAR(50)`, UPPER_CASE).
Во фронтенде дублирующий список ролей и матрица прав: `prodent-frontend/src/hooks/useUserRole.ts`.

При редактировании списка ролей обновлять **все три** места одновременно.

## Список ролей

| Роль | Назначение | Где назначается | Кабинет (FE) |
|---|---|---|---|
| `SUPER_ADMIN` | Полный доступ к платформе | вручную, скрипт seed | `/admin/*` |
| `ADMIN` | Администратор PRODENT | приглашение от SUPER_ADMIN | `/admin/*` |
| `MODERATOR` | Модерация контента, отзывов, верификаций | приглашение от ADMIN | `/admin/moderation`, `/admin/reviews`, `/admin/verification`, `/admin/blog` |
| `CLINIC_ADMIN` | Владелец/администратор клиники | при регистрации с role=clinic | `/clinic-admin/*` + `/crm/*` |
| `CLINIC_MANAGER` | Менеджер клиники (KPI, услуги, персонал) | приглашение от CLINIC_ADMIN | `/manager/*` |
| `DOCTOR` | Врач | при регистрации с role=doctor | `/doctor/*` |
| `ASSISTANT` | Ассистент врача | приглашение от CLINIC_ADMIN | `/assistant/*` |
| `ACCOUNTANT` | Бухгалтер клиники | приглашение от CLINIC_ADMIN | `/accountant/*` |
| `PATIENT` | Пациент | при регистрации с role=patient | `/patient/*` |

## Матрица прав на ключевые ресурсы

`✅` — полный доступ. `🔵` — только в своей клинике. `🟡` — только свои данные.
`👁` — read-only. `❌` — нет доступа.

| Ресурс | SUPER_ADMIN | ADMIN | MODERATOR | CLINIC_ADMIN | CLINIC_MANAGER | DOCTOR | ASSISTANT | ACCOUNTANT | PATIENT |
|---|---|---|---|---|---|---|---|---|---|
| Все клиники / пользователи | ✅ | ✅ | 👁 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Профиль клиники | ✅ | ✅ | 👁 | 🔵 | 🔵 | 👁 | 👁 | 👁 | 👁 публ. |
| Сотрудники клиники | ✅ | ✅ | ❌ | 🔵 | 🔵 | 👁 | 👁 | 👁 | ❌ |
| Расписание / записи | ✅ | 👁 | ❌ | 🔵 | 🔵 | 🟡 свой | 🔵 | 👁 | 🟡 свои |
| Услуги клиники | ✅ | ✅ | ❌ | 🔵 | 🔵 | 👁 | 👁 | 👁 | 👁 |
| Медкарты пациентов | ✅ audit | ❌ | ❌ | 🔵 | ❌ | 🔵 / 🟡 свои | 🔵 read | ❌ | 🟡 свои |
| Платежи / счета | ✅ | 👁 | ❌ | 🔵 | 👁 | 🟡 свои | ❌ | 🔵 | 🟡 свои |
| Зарплаты сотрудников | ✅ | ❌ | ❌ | 🔵 | ❌ | ❌ | ❌ | 🔵 | ❌ |
| Расходы клиники | ✅ | ❌ | ❌ | 🔵 | 👁 | ❌ | ❌ | 🔵 | ❌ |
| Склад / материалы | ✅ | ❌ | ❌ | 🔵 | 🔵 | 👁 | 🔵 | 👁 | ❌ |
| Кабинеты (rooms) | ✅ | ❌ | ❌ | 🔵 | 🔵 | 👁 | 🔵 | 👁 | ❌ |
| Лабораторные заказы | ✅ | ❌ | ❌ | 🔵 | 👁 | 🔵 | 👁 | 👁 | 🟡 свои |
| Медиа (рентген/фото) | ✅ | ❌ | ❌ | 🔵 | ❌ | 🔵 | 👁 | ❌ | 🟡 свои |
| KPI / аналитика клиники | ✅ | ✅ | ❌ | 🔵 | 🔵 | ❌ | ❌ | 👁 | ❌ |
| Реклама / промо | ✅ | ✅ | 🔵 одобр. | 🔵 | 🔵 | ❌ | ❌ | ❌ | 👁 |
| Блог / статьи | ✅ | ✅ | ✅ | 👁 | 👁 | 👁 | 👁 | 👁 | 👁 |
| Отзывы | ✅ | ✅ модер. | ✅ модер. | 🔵 reply | ❌ | 🟡 reply | ❌ | ❌ | 🟡 свой |

## Ограничения по таблицам Postgres

Таблицы, добавленные миграцией `V11__role_cabinets_extension.sql`:

| Таблица | Доступна для (через `DataController`) | Запись разрешена |
|---|---|---|
| `laboratory_orders` | DOCTOR, CLINIC_ADMIN, ASSISTANT (read), MANAGER, ACCOUNTANT (read) | DOCTOR, CLINIC_ADMIN |
| `medical_media` | DOCTOR (own), CLINIC_ADMIN, PATIENT (own) | DOCTOR, CLINIC_ADMIN |
| `rooms` | CLINIC_ADMIN, MANAGER, ASSISTANT (status update) | CLINIC_ADMIN, MANAGER |
| `materials`, `materials_stock` | CLINIC_ADMIN, MANAGER, ASSISTANT, ACCOUNTANT | CLINIC_ADMIN, MANAGER |
| `materials_usage` | CLINIC_ADMIN, MANAGER, ASSISTANT, DOCTOR | ASSISTANT, DOCTOR |
| `assistant_assignments` | CLINIC_ADMIN, MANAGER, ASSISTANT (own) | CLINIC_ADMIN, MANAGER |
| `salaries`, `salary_payouts` | CLINIC_ADMIN, ACCOUNTANT, сотрудник (own read) | CLINIC_ADMIN, ACCOUNTANT |
| `clinic_expenses` | CLINIC_ADMIN, ACCOUNTANT, MANAGER (read) | ACCOUNTANT, CLINIC_ADMIN |
| `manager_targets` | CLINIC_ADMIN, MANAGER | CLINIC_ADMIN, MANAGER |
| `v_debtors`, `v_clinic_kpi_daily`, `v_doctor_performance` | роли с `canAccessReports` (см. матрицу) | read-only views |

Эти ограничения **обязаны** быть продублированы:
1. На уровне Spring `@PreAuthorize` для не-DataController эндпоинтов.
2. На уровне `useUserRole.ts` — флаги `canAccess*`.
3. На уровне SQL — через RLS-политики или явные WHERE clinic_id (где применимо).

## Регистрационные роли

В `RoleSelector.tsx` пользователю предлагают только три варианта:

| Вариант | Назначаемая роль |
|---|---|
| `patient` | `PATIENT` |
| `doctor` | `DOCTOR` |
| `clinic` | `CLINIC_ADMIN` |

Остальные 6 ролей выдаются **только** через приглашения существующими CLINIC_ADMIN/ADMIN/SUPER_ADMIN.

## Multi-tenant scope

`UserRole` имеет поле `clinic_id` и unique-констрейнт `(user_id, role, clinic_id)`. Это значит:
- Один пользователь может работать врачом в N клиниках (запись в `user_roles` для каждой).
- Глобальные роли (SUPER_ADMIN, ADMIN, MODERATOR) — `clinic_id IS NULL`.
- Аудит назначения роли: `granted_by`, `granted_at`.

## Ссылки

- Backend enum: `prodent-backend/src/main/java/com/prodent/entity/UserRole.java`
- DB migration: `prodent-backend/src/main/resources/db/migration/V11__role_cabinets_extension.sql`
- Frontend hook: `prodent-frontend/src/hooks/useUserRole.ts`
- Whitelisted tables: `prodent-backend/src/main/java/com/prodent/controller/DataController.java`
- Layouts: `prodent-frontend/src/components/{admin,clinic-admin,manager,doctor,assistant,accountant}/`
