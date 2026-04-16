import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ToothStatus = 
  | 'healthy' 
  | 'caries' 
  | 'filling' 
  | 'crown' 
  | 'implant' 
  | 'removed' 
  | 'watch' 
  | 'endo' 
  | 'periodontitis'
  | 'early_caries'
  | 'pulpitis'
  | 'trauma'
  | 'erupting'
  | 'missing';

interface RealisticToothProps {
  number: number;
  status: ToothStatus;
  type: 'molar' | 'premolar' | 'canine' | 'incisor';
  isUpper: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  animationDelay?: number;
}

const STATUS_CONFIG: Record<ToothStatus, { fill: string; label: string; stroke?: string }> = {
  healthy: { fill: '#E8E4F0', label: 'Здоровый', stroke: '#C4BCD6' },
  caries: { fill: '#F2994A', label: 'Кариес', stroke: '#D97706' },
  filling: { fill: '#93C5FD', label: 'Пломба', stroke: '#3B82F6' },
  crown: { fill: '#FCD34D', label: 'Коронка', stroke: '#D97706' },
  implant: { fill: '#CBD5E1', label: 'Имплант', stroke: '#64748B' },
  removed: { fill: '#F3F4F6', label: 'Удалён', stroke: '#D1D5DB' },
  missing: { fill: '#F3F4F6', label: 'Отсутствует', stroke: '#D1D5DB' },
  watch: { fill: '#FDE68A', label: 'Под наблюдением', stroke: '#F59E0B' },
  endo: { fill: '#FCA5A5', label: 'Эндодонтия', stroke: '#EF4444' },
  periodontitis: { fill: '#F87171', label: 'Периодонтит', stroke: '#DC2626' },
  early_caries: { fill: '#FCD34D', label: 'Начальный кариес', stroke: '#F59E0B' },
  pulpitis: { fill: '#F87171', label: 'Пульпит', stroke: '#DC2626' },
  trauma: { fill: '#C4B5FD', label: 'Травма', stroke: '#7C3AED' },
  erupting: { fill: '#A5F3FC', label: 'Прорезывается', stroke: '#06B6D4' },
};

// SVG paths for different tooth types
const TOOTH_PATHS = {
  molar: {
    upper: "M8 2C4 2 2 6 2 12C2 18 4 26 8 28C10 29 14 29 16 28C20 26 22 18 22 12C22 6 20 2 16 2C14 2 10 2 8 2Z M6 8C6 8 8 6 12 6C16 6 18 8 18 8 M5 14C5 14 8 12 12 12C16 12 19 14 19 14",
    lower: "M8 26C4 26 2 22 2 16C2 10 4 2 8 0C10 -1 14 -1 16 0C20 2 22 10 22 16C22 22 20 26 16 26C14 26 10 26 8 26Z"
  },
  premolar: {
    upper: "M7 2C4 2 3 6 3 12C3 18 4 24 7 26C9 27 13 27 15 26C18 24 19 18 19 12C19 6 18 2 15 2C13 2 9 2 7 2Z",
    lower: "M7 24C4 24 3 20 3 14C3 8 4 2 7 0C9 -1 13 -1 15 0C18 2 19 8 19 14C19 20 18 24 15 24C13 24 9 24 7 24Z"
  },
  canine: {
    upper: "M8 2C5 2 4 8 4 14C4 20 5 28 8 30C10 31 12 31 14 30C17 28 18 20 18 14C18 8 17 2 14 2C12 2 10 2 8 2Z",
    lower: "M8 28C5 28 4 22 4 16C4 10 5 0 8 -2C10 -3 12 -3 14 -2C17 0 18 10 18 16C18 22 17 28 14 28C12 28 10 28 8 28Z"
  },
  incisor: {
    upper: "M6 2C4 2 3 6 3 12C3 18 4 24 6 26C8 27 12 27 14 26C16 24 17 18 17 12C17 6 16 2 14 2C12 2 8 2 6 2Z",
    lower: "M6 24C4 24 3 20 3 14C3 8 4 2 6 0C8 -1 12 -1 14 0C16 2 17 8 17 14C17 20 16 24 14 24C12 24 8 24 6 24Z"
  }
};

export function RealisticTooth({ 
  number, 
  status, 
  type,
  isUpper,
  isSelected = false,
  onClick,
  animationDelay = 0
}: RealisticToothProps) {
  const config = STATUS_CONFIG[status];
  const isMissing = status === 'missing' || status === 'removed';
  const isProblematic = ['caries', 'pulpitis', 'endo', 'periodontitis', 'early_caries', 'trauma'].includes(status);
  
  const path = TOOTH_PATHS[type][isUpper ? 'upper' : 'lower'];
  
  // Size based on tooth type
  const sizes = {
    molar: { width: 28, height: 36 },
    premolar: { width: 22, height: 32 },
    canine: { width: 20, height: 38 },
    incisor: { width: 18, height: 30 }
  };
  
  const size = sizes[type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            style={{ 
              animationDelay: `${animationDelay}ms`,
              ['--delay' as any]: `${animationDelay}ms`
            }}
            className={cn(
              "realistic-tooth relative group transition-all duration-300",
              "hover:-translate-y-1 hover:scale-105",
              isSelected && "scale-110 -translate-y-2 z-10",
              isMissing && "opacity-30"
            )}
          >
            <svg 
              width={size.width} 
              height={size.height} 
              viewBox={`0 0 ${type === 'molar' ? 24 : type === 'premolar' ? 22 : 20} ${type === 'canine' ? 32 : type === 'molar' ? 30 : 28}`}
              className="drop-shadow-md transition-all duration-300 group-hover:drop-shadow-lg"
            >
              {/* Gradient definitions */}
              <defs>
                <linearGradient id={`tooth-gradient-${number}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={config.fill} />
                  <stop offset="50%" stopColor={config.fill} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={config.stroke || config.fill} stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id={`tooth-highlight-${number}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
                {/* Shadow filter */}
                <filter id={`tooth-shadow-${number}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15"/>
                </filter>
              </defs>
              
              {/* Main tooth shape */}
              <path
                d={path}
                fill={`url(#tooth-gradient-${number})`}
                stroke={config.stroke || '#C4BCD6'}
                strokeWidth="1"
                filter={`url(#tooth-shadow-${number})`}
                className={cn(
                  "transition-all duration-300",
                  isSelected && "stroke-primary stroke-2"
                )}
              />
              
              {/* Highlight overlay */}
              <path
                d={path}
                fill={`url(#tooth-highlight-${number})`}
                className="pointer-events-none"
              />

              {/* Root lines for upper teeth */}
              {isUpper && type !== 'incisor' && (
                <g stroke={config.stroke || '#C4BCD6'} strokeWidth="0.5" opacity="0.4">
                  {type === 'molar' && (
                    <>
                      <line x1="8" y1="20" x2="6" y2="28" />
                      <line x1="12" y1="20" x2="12" y2="28" />
                      <line x1="16" y1="20" x2="18" y2="28" />
                    </>
                  )}
                  {type === 'premolar' && (
                    <>
                      <line x1="8" y1="18" x2="7" y2="24" />
                      <line x1="14" y1="18" x2="15" y2="24" />
                    </>
                  )}
                  {type === 'canine' && (
                    <line x1="11" y1="22" x2="11" y2="30" />
                  )}
                </g>
              )}

              {/* Crown indicator */}
              {status === 'crown' && (
                <path
                  d={path}
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="2"
                  strokeDasharray="3,2"
                  className="animate-pulse"
                />
              )}

              {/* Implant screw pattern */}
              {status === 'implant' && (
                <g stroke="#64748B" strokeWidth="0.5" opacity="0.6">
                  <line x1="6" y1="10" x2="16" y2="10" />
                  <line x1="6" y1="14" x2="16" y2="14" />
                  <line x1="6" y1="18" x2="16" y2="18" />
                </g>
              )}
            </svg>

            {/* Tooth number */}
            <span className={cn(
              "absolute bottom-[-18px] left-1/2 -translate-x-1/2",
              "text-[10px] font-medium text-muted-foreground",
              isSelected && "text-primary font-semibold"
            )}>
              {number}
            </span>

            {/* Problem indicator */}
            {isProblematic && !isMissing && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg">
          <div className="text-center">
            <p className="font-semibold text-sm">Зуб {number}</p>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { STATUS_CONFIG };
