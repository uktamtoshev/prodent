import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface StepperStep {
  id: string;
  label: ReactNode;
  description?: ReactNode;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  currentStep: number;
  label?: string;
  className?: string;
}

export function Stepper({ steps, currentStep, label, className }: StepperProps) {
  const systemLabel = useSystemLabel();
  return (
    <ol aria-label={label ?? systemLabel("steps")} className={cn("grid gap-4 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {steps.map((step, index) => {
        const number = index + 1;
        const complete = number < currentStep;
        const current = number === currentStep;
        return (
          <li key={step.id} aria-current={current ? "step" : undefined} className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                complete || current ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground",
              )}
            >
              {complete ? <Check aria-label={systemLabel("stepDone")} className="h-4 w-4" /> : number}
            </span>
            <span className="min-w-0 pt-1">
              <span className="block text-sm font-medium text-foreground">{step.label}</span>
              {step.description ? <span className="mt-1 block text-xs text-muted-foreground">{step.description}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
