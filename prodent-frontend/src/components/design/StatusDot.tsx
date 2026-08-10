import { cn } from "@/lib/utils";

type Tone = "emerald" | "amber" | "rose" | "slate";

export interface StatusDotProps {
  tone?: Tone;
  className?: string;
}

const tones: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export function StatusDot({ tone = "emerald", className }: StatusDotProps) {
  return <span aria-hidden="true" className={cn("inline-block w-1.5 h-1.5 rounded-full", tones[tone], className)} />;
}
