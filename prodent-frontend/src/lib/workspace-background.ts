/**
 * Фон рабочего пространства кабинета — личная настройка пользователя.
 *
 * Значение по умолчанию — "none": пока пользователь ничего не выбрал, кабинет
 * выглядит ровно так же, как до появления этой настройки. Ничего не пропадает.
 *
 * Хранится в localStorage рядом с языком (см. i18n/language-storage.ts) — это
 * оформление, а не данные клиники, поэтому на сервер не ходим. Запись через
 * safeSet, потому что в приватном режиме Safari localStorage кидает исключение.
 */

export const WORKSPACE_BACKGROUNDS = ["none", "aurora", "sky"] as const;

export type WorkspaceBackground = (typeof WORKSPACE_BACKGROUNDS)[number];

export const DEFAULT_WORKSPACE_BACKGROUND: WorkspaceBackground = "none";

const WORKSPACE_BACKGROUND_STORAGE_KEY = "prodent_workspace_background";

/** Событие, которым переключатель сообщает оболочке кабинета о смене фона. */
export const WORKSPACE_BACKGROUND_EVENT = "prodent:workspace-background";

interface SimpleStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getBrowserStorage(): SimpleStorage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function isWorkspaceBackground(value: unknown): value is WorkspaceBackground {
  return (
    typeof value === "string" &&
    (WORKSPACE_BACKGROUNDS as readonly string[]).includes(value)
  );
}

export function readWorkspaceBackground(
  storage: SimpleStorage | undefined = getBrowserStorage(),
): WorkspaceBackground {
  try {
    const stored = storage?.getItem(WORKSPACE_BACKGROUND_STORAGE_KEY);
    return isWorkspaceBackground(stored) ? stored : DEFAULT_WORKSPACE_BACKGROUND;
  } catch {
    return DEFAULT_WORKSPACE_BACKGROUND;
  }
}

export function writeWorkspaceBackground(
  value: WorkspaceBackground,
  storage: SimpleStorage | undefined = getBrowserStorage(),
): boolean {
  let stored = false;
  try {
    storage?.setItem(WORKSPACE_BACKGROUND_STORAGE_KEY, value);
    stored = true;
  } catch {
    stored = false;
  }
  // Оболочка кабинета и экран настроек живут в разных ветках дерева, общего
  // контекста у них нет. Событие дешевле нового провайдера и не трогает
  // существующие контексты, которые частично мокаются десятками тестов.
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<WorkspaceBackground>(WORKSPACE_BACKGROUND_EVENT, { detail: value }),
    );
  }
  return stored;
}
