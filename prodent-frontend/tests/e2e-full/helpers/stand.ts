import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Доступ к изолированному стенду E2E (docker compose проект "prodent-e2e").
 *
 * Зачем тесту лезть в базу: код из SMS нигде не отдаётся наружу (в ответе
 * send-otp только замаскированный телефон), а регистрацию надо проверять
 * целиком. В dry-run режиме код лежит в таблице phone_verifications открытым,
 * оттуда его и берём — ровно как человек взял бы его из SMS.
 */

/**
 * Ищем корень репозитория вверх от рабочей папки: тесты запускают и из
 * prodent-frontend, и из корня, а модуль грузится как ESM — __dirname тут нет.
 */
function findComposeFile(): string {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(dir, "ops", "e2e", "docker-compose.e2e.yml");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Не нашёл ops/e2e/docker-compose.e2e.yml — запускай тесты через ops/e2e/run-e2e.ps1",
  );
}

const COMPOSE_FILE = process.env.E2E_COMPOSE_FILE || findComposeFile();
const COMPOSE_PROJECT = process.env.E2E_COMPOSE_PROJECT || "prodent-e2e";
const REDIS_PASSWORD = process.env.E2E_REDIS_PASSWORD || "prodent-e2e-redis";

export const API_URL = process.env.PRODENT_API_URL || "http://127.0.0.1:8118";

function compose(args: string[], input?: string): string {
  const result = spawnSync(
    "docker",
    ["compose", "--project-name", COMPOSE_PROJECT, "-f", COMPOSE_FILE, ...args],
    { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (result.error) {
    throw new Error(`docker compose не запустился: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `docker compose ${args.join(" ")} → код ${result.status}\n${result.stderr || result.stdout}`,
    );
  }
  return (result.stdout || "").trim();
}

/** Один SQL-запрос к базе стенда. Возвращает результат без заголовков. */
export function sql(query: string): string {
  return compose(["exec", "-T", "postgres", "psql", "-U", "prodent", "-d", "prodent", "-At", "-c", query]);
}

/** Первая колонка первой строки (или null, если строк нет). */
export function sqlValue(query: string): string | null {
  const out = sql(query);
  if (!out) return null;
  return out.split("\n")[0].trim();
}

/** Строки результата, разбитые по разделителю `|`. */
export function sqlRows(query: string): string[][] {
  const out = sql(query);
  if (!out) return [];
  return out.split("\n").map((line) => line.split("|"));
}

/**
 * Сбрасывает счётчики антифрода (Redis). Лимиты живут там: 3 кода на телефон
 * за 10 минут, 12 на IP, плюс пауза 60 секунд между кодами. Набор тестов
 * регистрирует десяток пользователей подряд с одного адреса и без сброса
 * упёрся бы в лимит на середине — а проверяем мы регистрацию, не антифрод.
 * Сам лимит проверяется отдельным тестом, который сброс не делает.
 */
export function resetRateLimits(): void {
  compose(["exec", "-T", "redis", "redis-cli", "-a", REDIS_PASSWORD, "--no-auth-warning", "flushall"]);
}

/** Код из последнего SMS для номера (dry-run: код лежит в базе открытым). */
export function latestOtpCode(phone: string, purpose?: "REGISTRATION" | "LOGIN" | "PASSWORD_RESET"): string {
  const purposeFilter = purpose ? ` AND purpose = '${purpose}'` : "";
  const code = sqlValue(
    `SELECT code FROM phone_verifications
      WHERE phone = '${escape(phone)}' AND is_verified = false${purposeFilter}
      ORDER BY created_at DESC LIMIT 1`,
  );
  if (!code) {
    throw new Error(`Для номера ${phone} нет активного кода подтверждения`);
  }
  return code;
}

/** Роли пользователя по номеру телефона. */
export function rolesOf(phone: string): string[] {
  const rows = sql(
    `SELECT ur.role FROM user_roles ur
       JOIN users u ON u.id = ur.user_id
      WHERE u.phone = '${escape(phone)}'
      ORDER BY ur.role`,
  );
  return rows ? rows.split("\n").map((r) => r.trim()).filter(Boolean) : [];
}

export function userIdOf(phone: string): string | null {
  return sqlValue(`SELECT id FROM users WHERE phone = '${escape(phone)}' LIMIT 1`);
}

export function userCountByPhone(phone: string): number {
  return Number(sqlValue(`SELECT count(*) FROM users WHERE phone = '${escape(phone)}'`) || "0");
}

/**
 * Убирает за собой пользователей, созданных тестами.
 *
 * Тестовые номера всегда начинаются с +99893 — этот префикс не занят ни одним
 * сидом, поэтому чистка не заденет ни QA-аккаунты ролей, ни пилотные данные.
 */
export const TEST_PHONE_PREFIX = "+99893";

/**
 * Каскадное удаление «сверху вниз» по каталогу внешних ключей.
 *
 * Схема живая: таблицы-заявок, версий документов и журналов появляются от ветки
 * к ветке, а цепочки бывают глубокими (запись → счёт → оплата → событие
 * финансов), поэтому зависимости не захардкожены, а читаются из каталога и
 * обходятся рекурсивно.
 *
 * Ссылки таблицы на саму себя (кто кого пригласил, кто кому выдал роль) не
 * раскручиваются: иначе уборка утащила бы за собой посторонние строки. Такие
 * ссылки просто обнуляются.
 */
const CASCADE_FUNCTION = `
  CREATE OR REPLACE FUNCTION e2e_cascade_delete(p_table text, p_ids uuid[], p_depth int DEFAULT 0)
  RETURNS void AS $fn$
  DECLARE
      child record;
      child_ids uuid[];
  BEGIN
      IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR p_depth > 6 THEN
          RETURN;
      END IF;

      FOR child IN
          SELECT tc.table_name AS tbl, kcu.column_name AS col
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON kcu.constraint_name = tc.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND ccu.table_name = p_table
             AND ccu.column_name = 'id'
             AND tc.table_schema = 'public'
      LOOP
          IF child.tbl = p_table THEN
              -- Ссылка на саму себя: обнуляем, если колонка это позволяет.
              BEGIN
                  EXECUTE format('UPDATE %I SET %I = NULL WHERE %I = ANY($1)',
                                 child.tbl, child.col, child.col) USING p_ids;
              EXCEPTION WHEN not_null_violation THEN
                  NULL;
              END;
              CONTINUE;
          END IF;

          BEGIN
              EXECUTE format('SELECT array_agg(id) FROM %I WHERE %I = ANY($1)', child.tbl, child.col)
                INTO child_ids USING p_ids;
          EXCEPTION WHEN undefined_column THEN
              child_ids := NULL;
          END;

          IF child_ids IS NOT NULL THEN
              PERFORM e2e_cascade_delete(child.tbl, child_ids, p_depth + 1);
          ELSE
              EXECUTE format('DELETE FROM %I WHERE %I = ANY($1)', child.tbl, child.col) USING p_ids;
          END IF;
      END LOOP;

      EXECUTE format('DELETE FROM %I WHERE id = ANY($1)', p_table) USING p_ids;
  END;
  $fn$ LANGUAGE plpgsql;
`;

let cascadeReady = false;

function ensureCascadeFunction(): void {
  if (cascadeReady) return;
  sql(CASCADE_FUNCTION);
  cascadeReady = true;
}

export function cascadeDeleteRows(rootTable: string, victimsQuery: string): void {
  cascadeDelete(rootTable, victimsQuery);
}

/**
 * Часть таблиц продукта защищена триггерами «только дополнять» (журналы событий,
 * согласия с документами) — и это правильно. Уборка тестовых данных снимает
 * триггеры на время одной транзакции: `session_replication_role = replica`
 * действует только в этом соединении и возвращается сразу же.
 */
function cascadeDelete(rootTable: string, victimsQuery: string): void {
  ensureCascadeFunction();
  sql(`
    BEGIN;
    SET LOCAL session_replication_role = 'replica';
    SELECT e2e_cascade_delete('${rootTable}', ARRAY(${victimsQuery})::uuid[]);
    COMMIT;
  `);
}

export function cleanupTestUsers(): void {
  ensureCascadeFunction();
  // Согласия с документами и журналы событий защищены триггерами «изменять
  // нельзя» — так и задумано. Уборка снимает их на одну транзакцию (см.
  // cascadeDelete): при любой ошибке откат вернёт защиту на место.
  sql(`
    BEGIN;
    SET LOCAL session_replication_role = 'replica';
    SELECT e2e_cascade_delete(
      'users',
      ARRAY(SELECT id FROM users WHERE phone LIKE '${TEST_PHONE_PREFIX}%')::uuid[]
    );
    DELETE FROM phone_verifications WHERE phone LIKE '${TEST_PHONE_PREFIX}%';
    COMMIT;
  `);
}

/**
 * Убирает записи на приём, созданные тестами: все записи врача на выбранный
 * тестовый день. День берётся далеко вперёд (см. 02-patient-appointments),
 * поэтому сидовые записи возле сегодняшней даты не страдают.
 */
export function cleanupAppointmentsForDate(doctorId: string, date: string): void {
  cascadeDelete(
    "appointments",
    `SELECT id FROM appointments
      WHERE doctor_id = '${escape(doctorId)}'::uuid
        AND appointment_date = '${escape(date)}'::date`,
  );
}

/** Уникальный тестовый номер: +99893 и 7 цифр. */
export function newTestPhone(seed: number): string {
  const tail = String((Date.now() + seed * 977) % 10_000_000).padStart(7, "0");
  return `${TEST_PHONE_PREFIX}${tail}`;
}

function escape(value: string): string {
  return value.replace(/'/g, "''");
}
