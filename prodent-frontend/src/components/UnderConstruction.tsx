import { Construction } from "lucide-react";

interface UnderConstructionProps {
  /** Section name, e.g. "Счета" — shown in the heading. */
  title?: string;
  /** Optional override for the explanatory line. */
  description?: string;
}

/**
 * Shared placeholder for cabinet sections that aren't built yet. Replaces the
 * "header with an empty white body" look (which reads as a broken page) with an
 * honest "this section is in development" state.
 */
export function UnderConstruction({ title, description }: UnderConstructionProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-foreground">
        {title ? `${title}: раздел в разработке` : "Раздел в разработке"}
      </h2>
      <p className="max-w-md text-muted-foreground">
        {description ??
          "Мы ещё работаем над этой частью кабинета. Она появится в одном из ближайших обновлений."}
      </p>
    </div>
  );
}

export default UnderConstruction;
