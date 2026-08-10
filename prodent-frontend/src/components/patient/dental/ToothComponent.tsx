import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ChildToothStatus = 
  | 'healthy' 
  | 'early_caries' 
  | 'caries' 
  | 'pulpitis' 
  | 'trauma' 
  | 'erupting' 
  | 'missing' 
  | 'watch';

export type AdultToothStatus = 
  | 'healthy' 
  | 'caries' 
  | 'filling' 
  | 'crown' 
  | 'implant' 
  | 'removed' 
  | 'watch' 
  | 'endo' 
  | 'periodontitis';

export type ToothStatus = ChildToothStatus | AdultToothStatus;

interface ToothComponentProps {
  number: number;
  status: ToothStatus;
  isChild?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  animationDelay?: number;
}

const CHILD_STATUS_CONFIG: Record<ChildToothStatus, { color: string; label: string; glow?: string }> = {
  healthy: { color: 'from-[#81E0C2] to-[#4ECDC4]', label: 'Здоровый', glow: 'shadow-[0_0_15px_rgba(129,224,194,0.5)]' },
  early_caries: { color: 'from-[#F2C94C] to-[#F2994A]', label: 'Начальный кариес', glow: 'shadow-[0_0_15px_rgba(242,201,76,0.6)]' },
  caries: { color: 'from-[#F2994A] to-[#EB5757]', label: 'Кариес', glow: 'shadow-[0_0_15px_rgba(242,153,74,0.6)]' },
  pulpitis: { color: 'from-[#EB5757] to-[#C0392B]', label: 'Пульпит', glow: 'shadow-[0_0_15px_rgba(235,87,87,0.6)]' },
  trauma: { color: 'from-[#9B51E0] to-[#6C3483]', label: 'Травма', glow: 'shadow-[0_0_15px_rgba(155,81,224,0.6)]' },
  erupting: { color: 'from-[#56CCF2] to-[#2F80ED]', label: 'Прорезывается', glow: 'shadow-[0_0_20px_rgba(86,204,242,0.7)]' },
  missing: { color: 'from-muted/40 to-muted/20', label: 'Выпал' },
  watch: { color: 'from-[#F2C94C]/70 to-[#F2994A]/50', label: 'Под наблюдением', glow: 'shadow-[0_0_12px_rgba(242,201,76,0.4)]' },
};

const ADULT_STATUS_CONFIG: Record<AdultToothStatus, { color: string; label: string; glow?: string }> = {
  healthy: { color: 'from-primary to-oriental-emerald', label: 'Здоровый', glow: 'shadow-[0_0_15px_rgba(42,182,166,0.5)]' },
  caries: { color: 'from-amber-400 to-amber-600', label: 'Кариес', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.6)]' },
  filling: { color: 'from-tashkent-sky to-samarkand-blue', label: 'Пломба', glow: 'shadow-[0_0_15px_rgba(77,183,227,0.5)]' },
  crown: { color: 'from-desert-gold to-[#B8860B]', label: 'Коронка', glow: 'shadow-[0_0_20px_rgba(203,168,109,0.7)]' },
  implant: { color: 'from-slate-300 via-slate-100 to-slate-400', label: 'Имплант', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.6)]' },
  removed: { color: 'from-muted/30 to-muted/10', label: 'Удалён' },
  watch: { color: 'from-amber-300/70 to-amber-500/50', label: 'Под наблюдением', glow: 'shadow-[0_0_12px_rgba(252,211,77,0.4)]' },
  endo: { color: 'from-rose-400 to-rose-600', label: 'Эндодонтия', glow: 'shadow-[0_0_15px_rgba(251,113,133,0.6)]' },
  periodontitis: { color: 'from-red-400 to-red-600', label: 'Периодонтит', glow: 'shadow-[0_0_15px_rgba(248,113,113,0.6)]' },
};

export function ToothComponent({ 
  number, 
  status, 
  isChild = false,
  isSelected = false,
  onClick,
  animationDelay = 0
}: ToothComponentProps) {
  const config = isChild 
    ? CHILD_STATUS_CONFIG[status as ChildToothStatus] 
    : ADULT_STATUS_CONFIG[status as AdultToothStatus];

  const isProblematic = ['caries', 'pulpitis', 'trauma', 'endo', 'periodontitis', 'early_caries'].includes(status);
  const isMissing = status === 'missing' || status === 'removed';
  const isErupting = status === 'erupting';
  const isCrown = status === 'crown';
  const isImplant = status === 'implant';
  const animationStyle: CSSProperties & { "--delay": string } = {
    animationDelay: `${animationDelay}ms`,
    "--delay": `${animationDelay}ms`,
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            style={animationStyle}
            className={cn(
              "tooth-btn relative group",
              isChild ? "w-9 h-11 md:w-11 md:h-14" : "w-8 h-10 md:w-10 md:h-12",
              isMissing && "opacity-40"
            )}
          >
            {/* Glow effect on hover */}
            <div className={cn(
              "absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md -z-10",
              `bg-gradient-to-br ${config.color}`
            )} />

            {/* Main tooth shape */}
            <div
              className={cn(
                "tooth-shape absolute inset-0",
                isChild ? "rounded-[45%]" : "rounded-[35%_35%_45%_45%]",
                `bg-gradient-to-br ${config.color}`,
                config.glow,
                isSelected && "tooth-selected ring-2 ring-white ring-offset-2 ring-offset-background",
                isMissing && "tooth-missing",
                isErupting && "tooth-erupting",
                isCrown && "tooth-crown",
                isImplant && "tooth-implant"
              )}
            >
              {/* Inner highlight */}
              <div className={cn(
                "absolute inset-[3px] rounded-[inherit] opacity-60",
                "bg-gradient-to-br from-white/40 via-transparent to-black/10"
              )} />

              {/* Crown sparkle */}
              {isCrown && (
                <>
                  <div className="absolute top-1 left-1 w-1.5 h-1.5 bg-white/80 rounded-full animate-sparkle" />
                  <div className="absolute top-2 right-2 w-1 h-1 bg-white/60 rounded-full animate-sparkle" style={{ animationDelay: '0.5s' }} />
                </>
              )}

              {/* Implant lines */}
              {isImplant && (
                <div className="absolute inset-x-2 top-1/2 space-y-1">
                  <div className="h-[1px] bg-slate-500/40 rounded" />
                  <div className="h-[1px] bg-slate-500/30 rounded mx-0.5" />
                </div>
              )}
            </div>

            {/* Tooth number */}
            <span className={cn(
              "absolute inset-0 flex items-center justify-center z-10",
              "text-[10px] md:text-xs font-bold tracking-tight",
              isMissing ? "text-muted-foreground/60" : "text-white",
              "drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
              isImplant && "text-slate-600"
            )}>
              {number}
            </span>

            {/* Problem pulse indicator */}
            {isProblematic && !isMissing && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card/95 backdrop-blur-sm border-border/50 shadow-strong px-3 py-2">
          <div className="text-center">
            <p className="font-semibold text-sm">Зуб {number}</p>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { CHILD_STATUS_CONFIG, ADULT_STATUS_CONFIG };
