import { useId, type FormEventHandler, type ReactNode } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface FilterBarProps {
  search?: { value: string; onChange: (value: string) => void; label?: string; placeholder?: string };
  filters?: ReactNode;
  actions?: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  className?: string;
}

export function FilterBar({
  search,
  filters,
  actions,
  onClear,
  clearLabel,
  onSubmit,
  className,
}: FilterBarProps) {
  const label = useSystemLabel();
  const resolvedClearLabel = clearLabel ?? label("clear");
  const searchId = `system-filter-search-${useId().replace(/:/g, "")}`;

  return (
    <form
      aria-label={label("filters")}
      onSubmit={onSubmit}
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-end", className)}
    >
      {search ? (
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={searchId}>{search.label ?? label("search")}</Label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder}
              className="pl-9"
            />
          </div>
        </div>
      ) : null}
      {filters ? <div className="flex flex-1 flex-wrap items-end gap-3">{filters}</div> : null}
      <div className="flex flex-wrap items-center gap-2">
        {onClear ? (
          <Button type="button" variant="ghost" onClick={onClear}>
            <X aria-hidden="true" className="mr-2 h-4 w-4" />
            {resolvedClearLabel}
          </Button>
        ) : null}
        {actions}
      </div>
    </form>
  );
}
