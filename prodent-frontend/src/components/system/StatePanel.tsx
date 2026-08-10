import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CloudOff, LockKeyhole, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StatePanelAction =
  | { actionLabel: string; onAction: () => void }
  | { actionLabel?: never; onAction?: never };

export type StatePanelProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  className?: string;
  role?: "status" | "alert";
  headingLevel?: 2 | 3;
} & StatePanelAction;

export function StatePanel({
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  className,
  role = "status",
  headingLevel = 2,
}: StatePanelProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";

  return (
    <section
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-prodent border border-dashed bg-card p-6 text-center",
        className,
      )}
      role={role}
    >
      <span className="mb-4 rounded-full bg-muted p-3 text-muted-foreground" aria-hidden="true">
        <Icon className="size-6" />
      </span>
      <Heading className="text-xl font-semibold">{title}</Heading>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}

type PresetStateProps = Omit<StatePanelProps, "icon" | "role">;

export function EmptyState(props: PresetStateProps) {
  return <StatePanel icon={SearchX} {...props} />;
}

export function ErrorState(props: PresetStateProps) {
  return <StatePanel icon={AlertTriangle} role="alert" {...props} />;
}

export function PermissionState(props: PresetStateProps) {
  return <StatePanel icon={LockKeyhole} {...props} />;
}

export function OfflineState(props: PresetStateProps) {
  return <StatePanel icon={CloudOff} {...props} />;
}
