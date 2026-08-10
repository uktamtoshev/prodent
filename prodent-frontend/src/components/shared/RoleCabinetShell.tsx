import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SkeletonComposition } from "@/components/system/SkeletonComposition";
import { useSystemLabel } from "@/components/system/system-labels";
import { useWorkspaceBackground } from "@/hooks/useWorkspaceBackground";

interface RoleCabinetShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  mainClassName?: string;
  /**
   * The cabinet's single sticky top bar, rendered as the first thing inside
   * `<main>`. Passing it also removes the `pt-16` that used to reserve room for
   * the floating mobile trigger, since a cabinet with a real bar has no
   * floating trigger. Omit it and the previous layout is preserved exactly, for
   * cabinets that have not been migrated yet.
   */
  topBar?: ReactNode;
}

/**
 * Сколько оболочек кабинета сейчас смонтировано.
 *
 * Считаем, а не ставим булев флаг: при переходе между кабинетами React
 * монтирует новую оболочку РАНЬШЕ, чем размонтирует старую, и уборка старой
 * сняла бы признак, который уже нужен новой. То же самое в StrictMode, где
 * эффекты намеренно прогоняются дважды.
 */
let mountedCabinets = 0;

/**
 * Помечает <html> признаком кабинета на время жизни оболочки.
 *
 * Зачем на <html>, а не на самой оболочке: Radix (Dialog, Sheet, Select,
 * Popover, DropdownMenu) рендерит содержимое ПОРТАЛОМ в document.body, то есть
 * мимо оболочки — она лежит в body > #root > #main-content > div. Правило,
 * привязанное к оболочке, до модалки не достаёт, и модалка остаётся с прежним
 * оформлением: на странице карточка непрозрачная, а в модалке просвечивает.
 * Признак на корне документа накрывает и страницу, и порталы.
 */
function useCabinetMarker() {
  useEffect(() => {
    mountedCabinets += 1;
    document.documentElement.setAttribute("data-cabinet", "");

    return () => {
      mountedCabinets -= 1;
      if (mountedCabinets === 0) {
        document.documentElement.removeAttribute("data-cabinet");
      }
    };
  }, []);
}

export function RoleCabinetShell({
  children,
  sidebar,
  isLoading = false,
  loadingLabel,
  mainClassName,
  topBar,
}: RoleCabinetShellProps) {
  const systemLabel = useSystemLabel();
  const resolvedLoadingLabel = loadingLabel ?? systemLabel("loadingCabinet");
  const workspaceBackground = useWorkspaceBackground();

  useCabinetMarker();

  /**
   * Обои рабочего пространства.
   *
   * Слой лежит СЕСТРОЙ к <main>, а не обёрткой вокруг него: контрактный тест
   * RoleCabinetShell.test.tsx проверяет классы у main.parentElement, и лишняя
   * обёртка его сломает.
   *
   * Порядок закраски: абсолютный слой позиционирован, поэтому без правки он
   * закрасил бы содержимое. Поэтому <main> тоже получает relative — два
   * позиционированных элемента рисуются в порядке DOM, и main оказывается сверху.
   *
   * Пока фон не выбран (значение по умолчанию), слой не рендерится вовсе и
   * кабинет выглядит ровно как раньше.
   */
  const wallpaper =
    workspaceBackground === "none" ? null : (
      <div aria-hidden="true" className="workspace-wallpaper pointer-events-none absolute inset-0" />
    );

  /**
   * Атрибут висит на внешнем контейнере, а не на самом слое: по нему CSS не
   * только рисует обои, но и делает непрозрачными полупрозрачные поверхности
   * внутри кабинета. Иначе градиент проступает прямо под текстом в таблицах,
   * где фон задан как bg-background/50.
   */
  const shellProps = { "data-workspace-bg": workspaceBackground } as const;

  if (isLoading) {
    /**
     * A skeleton in the real frame, not a centred spinner on a blank page.
     *
     * The spinner threw away the navigation on every cold load: the sidebar
     * vanished, the page jumped when content arrived, and the user lost the
     * answer to "where am I" during the slowest moment of the session. Keeping
     * the shell and shimmering only the content area holds the layout still
     * (no CLS) and keeps the menu usable while data is in flight.
     */
    return (
      <div
        {...shellProps}
        className="relative flex min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground"
      >
        {wallpaper}
        {sidebar}
        <main
          className={cn(
            "relative min-h-screen min-w-0 max-w-full flex-1 lg:pl-64",
            topBar ? undefined : "pt-16 lg:pt-0",
            mainClassName,
          )}
          aria-busy="true"
        >
          {topBar}
          <div className="p-4 lg:p-6">
            {/* SkeletonComposition owns the single role="status" here — nesting
                a second one makes the region ambiguous to screen readers. */}
            <SkeletonComposition
              label={resolvedLoadingLabel}
              cards={4}
              rows={5}
              className="max-w-[1440px]"
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      {...shellProps}
      className="relative flex min-h-screen w-full max-w-full overflow-x-clip bg-background text-foreground"
    >
      {wallpaper}
      {sidebar}
      <main
        className={cn(
          "relative min-h-screen min-w-0 max-w-full flex-1 lg:pl-64",
          topBar ? undefined : "pt-16 lg:pt-0",
          mainClassName,
        )}
      >
        {topBar}
        {children}
      </main>
    </div>
  );
}
