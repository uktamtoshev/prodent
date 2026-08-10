import { useEffect, useState } from "react";

import {
  DEFAULT_WORKSPACE_BACKGROUND,
  WORKSPACE_BACKGROUND_EVENT,
  isWorkspaceBackground,
  readWorkspaceBackground,
  type WorkspaceBackground,
} from "@/lib/workspace-background";

/**
 * Читает выбранный пользователем фон рабочего пространства и следит за его сменой.
 *
 * Начальное значение берём НЕ в useState(readWorkspaceBackground()), а после
 * монтирования: при серверном рендере и в тестах localStorage может отсутствовать,
 * а расхождение первого рендера с разметкой даёт мигание фона.
 *
 * Слушаем два события: своё (смена в этой же вкладке) и storage (смена в соседней).
 */
export function useWorkspaceBackground(): WorkspaceBackground {
  const [background, setBackground] = useState<WorkspaceBackground>(
    DEFAULT_WORKSPACE_BACKGROUND,
  );

  useEffect(() => {
    setBackground(readWorkspaceBackground());

    const handleLocal = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (isWorkspaceBackground(value)) setBackground(value);
    };
    const handleStorage = () => setBackground(readWorkspaceBackground());

    window.addEventListener(WORKSPACE_BACKGROUND_EVENT, handleLocal);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(WORKSPACE_BACKGROUND_EVENT, handleLocal);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return background;
}
