import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Baby, User, ZoomIn, ZoomOut, RotateCcw, Heart, AlertTriangle } from "lucide-react";
import { SmartToothDetailCard } from "./SmartToothDetailCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const STATUS_CONFIG: Record<ToothStatus, { 
  label: string; 
  emoji: string;
  gradient: { light: string; mid: string; dark: string };
  glow: string;
  pulse: boolean;
  dotColor: string;
}> = {
  healthy: { 
    label: 'Здоровый', emoji: '✓',
    gradient: { light: '#FFFFFF', mid: '#F0EFEF', dark: '#D8D5DD' },
    glow: 'transparent', pulse: false, dotColor: '#10B981'
  },
  caries: { 
    label: 'Кариес', emoji: '⚠',
    gradient: { light: '#FEF3C7', mid: '#FCD34D', dark: '#B45309' },
    glow: '#F59E0B', pulse: true, dotColor: '#F59E0B'
  },
  filling: { 
    label: 'Пломба', emoji: '●',
    gradient: { light: '#DBEAFE', mid: '#93C5FD', dark: '#2563EB' },
    glow: '#3B82F6', pulse: false, dotColor: '#3B82F6'
  },
  crown: { 
    label: 'Коронка', emoji: '👑',
    gradient: { light: '#FEF9C3', mid: '#FDE68A', dark: '#B45309' },
    glow: '#EAB308', pulse: false, dotColor: '#EAB308'
  },
  implant: { 
    label: 'Имплант', emoji: '⬡',
    gradient: { light: '#E5E7EB', mid: '#9CA3AF', dark: '#4B5563' },
    glow: '#6B7280', pulse: false, dotColor: '#6B7280'
  },
  removed: { 
    label: 'Удалён', emoji: '✕',
    gradient: { light: '#F3F4F6', mid: '#D1D5DB', dark: '#6B7280' },
    glow: 'transparent', pulse: false, dotColor: '#9CA3AF'
  },
  watch: { 
    label: 'Наблюдение', emoji: '👁',
    gradient: { light: '#FED7AA', mid: '#FDBA74', dark: '#C2410C' },
    glow: '#F97316', pulse: true, dotColor: '#F97316'
  },
  endo: { 
    label: 'Эндодонтия', emoji: '⚡',
    gradient: { light: '#FECACA', mid: '#FCA5A5', dark: '#B91C1C' },
    glow: '#EF4444', pulse: true, dotColor: '#EF4444'
  },
  periodontitis: { 
    label: 'Периодонтит', emoji: '!',
    gradient: { light: '#FEE2E2', mid: '#F87171', dark: '#991B1B' },
    glow: '#DC2626', pulse: true, dotColor: '#DC2626'
  },
};

// Tooth SVG component
const UltraRealistic3DTooth = ({ 
  number, type, isUpper, status, isSelected, onClick, scale = 1, animationDelay = 0
}: { 
  number: number;
  type: 'molar' | 'premolar' | 'canine' | 'incisor';
  isUpper: boolean;
  status: ToothStatus;
  isSelected: boolean;
  onClick: () => void;
  scale?: number;
  animationDelay?: number;
}) => {
  const config = STATUS_CONFIG[status];
  const isMissing = status === 'removed';
  const isProblematic = config.pulse;
  const id = `ultra-tooth-${number}-${Math.random().toString(36).substr(2, 5)}`;

  const getDimensions = () => {
    const base = {
      molar: { width: 48, height: 54, viewBox: "0 0 100 110" },
      premolar: { width: 38, height: 48, viewBox: "0 0 80 100" },
      canine: { width: 32, height: 52, viewBox: "0 0 70 110" },
      incisor: { width: 28, height: 44, viewBox: "0 0 60 90" }
    };
    return base[type];
  };

  const dims = getDimensions();

  const getCrownPath = () => {
    switch (type) {
      case 'molar':
        return isUpper 
          ? `M12 85 C6 78 4 65 6 48 Q8 32 18 20 Q28 10 40 8 Q52 6 65 8 Q78 12 86 24 Q94 38 94 52 C96 68 94 80 88 88 Q82 95 70 98 Q55 102 45 100 Q30 98 20 92 Q14 88 12 85 Z`
          : `M12 25 C6 32 4 45 6 62 Q8 78 18 90 Q28 100 40 102 Q52 104 65 102 Q78 98 86 86 Q94 72 94 58 C96 42 94 30 88 22 Q82 15 70 12 Q55 8 45 10 Q30 12 20 18 Q14 22 12 25 Z`;
      case 'premolar':
        return isUpper 
          ? `M10 78 C5 70 4 55 7 42 Q10 28 20 18 Q30 10 40 8 Q52 8 62 16 Q72 26 74 42 C76 58 74 72 68 80 Q62 88 50 90 Q36 92 24 88 Q14 84 10 78 Z`
          : `M10 22 C5 30 4 45 7 58 Q10 72 20 82 Q30 90 40 92 Q52 92 62 84 Q72 74 74 58 C76 42 74 28 68 20 Q62 12 50 10 Q36 8 24 12 Q14 16 10 22 Z`;
      case 'canine':
        return isUpper 
          ? `M14 90 C8 82 6 68 8 52 Q10 35 18 22 Q26 10 35 6 Q44 10 52 22 Q60 35 62 52 C64 68 62 82 56 90 Q50 98 42 100 Q35 102 28 100 Q20 98 14 90 Z`
          : `M14 20 C8 28 6 42 8 58 Q10 75 18 88 Q26 100 35 104 Q44 100 52 88 Q60 75 62 58 C64 42 62 28 56 20 Q50 12 42 10 Q35 8 28 10 Q20 12 14 20 Z`;
      case 'incisor':
        return isUpper 
          ? `M10 72 C6 65 5 52 8 40 Q11 28 18 18 Q25 10 30 8 Q35 10 42 18 Q49 28 52 40 C55 52 54 65 50 72 Q46 80 38 82 Q30 84 22 82 Q14 78 10 72 Z`
          : `M10 18 C6 25 5 38 8 50 Q11 62 18 72 Q25 80 30 82 Q35 80 42 72 Q49 62 52 50 C55 38 54 25 50 18 Q46 10 38 8 Q30 6 22 8 Q14 12 10 18 Z`;
    }
  };

  const getOcclusalDetails = () => {
    if (type === 'molar') {
      return {
        fissures: [
          `M28 ${isUpper ? 55 : 55} Q42 ${isUpper ? 45 : 65} 50 ${isUpper ? 50 : 60} Q58 ${isUpper ? 45 : 65} 72 ${isUpper ? 55 : 55}`,
          `M50 ${isUpper ? 50 : 60} L50 ${isUpper ? 65 : 45}`,
          `M35 ${isUpper ? 60 : 50} Q50 ${isUpper ? 55 : 55} 65 ${isUpper ? 60 : 50}`
        ],
        cusps: [
          { cx: 28, cy: isUpper ? 45 : 65 },
          { cx: 72, cy: isUpper ? 45 : 65 },
          { cx: 25, cy: isUpper ? 68 : 42 },
          { cx: 75, cy: isUpper ? 68 : 42 },
          { cx: 50, cy: isUpper ? 52 : 58 }
        ]
      };
    }
    if (type === 'premolar') {
      return {
        fissures: [
          `M25 ${isUpper ? 48 : 52} Q40 ${isUpper ? 40 : 60} 55 ${isUpper ? 48 : 52}`
        ],
        cusps: [
          { cx: 30, cy: isUpper ? 38 : 62 },
          { cx: 50, cy: isUpper ? 38 : 62 }
        ]
      };
    }
    return { fissures: [], cusps: [] };
  };

  const occlusal = getOcclusalDetails();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isMissing}
            style={{ animationDelay: `${animationDelay}ms`, transform: `scale(${scale})` }}
            className={cn(
              "dental-tooth relative flex flex-col items-center gap-0.5 group",
              "transition-all duration-300 ease-out origin-bottom",
              "hover:-translate-y-2 hover:scale-110",
              isSelected && "scale-115 -translate-y-3 z-30",
              isMissing && "opacity-15 cursor-not-allowed hover:scale-100 hover:translate-y-0",
              !isMissing && "cursor-pointer"
            )}
          >
            <svg 
              width={dims.width} height={dims.height} viewBox={dims.viewBox}
              className={cn("transition-all duration-300 drop-shadow-sm", isProblematic && !isMissing && "animate-pulse")}
            >
              <defs>
                <linearGradient id={`${id}-enamel`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={config.gradient.light} />
                  <stop offset="50%" stopColor={config.gradient.mid} stopOpacity="0.85" />
                  <stop offset="100%" stopColor={config.gradient.dark} stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id={`${id}-pearl`} x1="10%" y1="0%" x2="90%" y2="70%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.9" />
                  <stop offset="35%" stopColor="white" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <radialGradient id={`${id}-highlight`} cx="35%" cy="25%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <filter id={`${id}-shadow`} x="-20%" y="-10%" width="140%" height="130%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f0f23" floodOpacity="0.15"/>
                </filter>
                {isSelected && (
                  <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" result="blur"/>
                    <feFlood floodColor="hsl(175, 82%, 45%)" result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="glow"/>
                    <feMerge>
                      <feMergeNode in="glow"/>
                      <feMergeNode in="glow"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                )}
                {isProblematic && !isSelected && (
                  <filter id={`${id}-status-glow`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feFlood floodColor={config.glow} result="color"/>
                    <feComposite in="color" in2="blur" operator="in" result="glow"/>
                    <feMerge>
                      <feMergeNode in="glow"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                )}
              </defs>

              <g filter={isSelected ? `url(#${id}-glow)` : isProblematic ? `url(#${id}-status-glow)` : `url(#${id}-shadow)`}>
                <path d={getCrownPath()} fill={`url(#${id}-enamel)`}
                  stroke={isSelected ? 'hsl(175, 82%, 40%)' : 'hsl(var(--border))'}
                  strokeWidth={isSelected ? 2.5 : 0.8} />
                <path d={getCrownPath()} fill={`url(#${id}-pearl)`} className="pointer-events-none" />
                <path d={getCrownPath()} fill={`url(#${id}-highlight)`} className="pointer-events-none" />
              </g>

              {occlusal.fissures.map((fissure, i) => (
                <path key={i} d={fissure} fill="none" stroke="#8B7B9B" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round" />
              ))}
              {occlusal.cusps.map((cusp, i) => (
                <circle key={i} cx={cusp.cx} cy={cusp.cy} r="2.5" fill="white" fillOpacity="0.4" />
              ))}

              {status === 'crown' && (
                <path d={getCrownPath()} fill="none" stroke="#DAA520" strokeWidth="2.5" strokeDasharray="6,3" opacity="0.8" />
              )}
              {status === 'filling' && (
                <ellipse
                  cx={type === 'molar' ? 50 : type === 'premolar' ? 40 : type === 'canine' ? 35 : 30}
                  cy={type === 'molar' ? 55 : type === 'premolar' ? 50 : type === 'canine' ? 55 : 45}
                  rx={type === 'molar' ? 12 : 8} ry={type === 'molar' ? 10 : 6}
                  fill="#64748B" opacity="0.75" stroke="#475569" strokeWidth="0.8" />
              )}
              {status === 'caries' && (
                <ellipse
                  cx={type === 'molar' ? 50 : type === 'premolar' ? 40 : type === 'canine' ? 35 : 30}
                  cy={type === 'molar' ? 55 : type === 'premolar' ? 50 : type === 'canine' ? 55 : 45}
                  rx={type === 'molar' ? 10 : 7} ry={type === 'molar' ? 8 : 5}
                  fill="#7C2D12" opacity="0.8" />
              )}
              {status === 'implant' && (
                <g>
                  <circle cx={type === 'molar' ? 50 : type === 'premolar' ? 40 : type === 'canine' ? 35 : 30}
                    cy={type === 'molar' ? 55 : type === 'premolar' ? 50 : type === 'canine' ? 55 : 45}
                    r="6" fill="#52525B" opacity="0.5" />
                  <circle cx={type === 'molar' ? 50 : type === 'premolar' ? 40 : type === 'canine' ? 35 : 30}
                    cy={type === 'molar' ? 55 : type === 'premolar' ? 50 : type === 'canine' ? 55 : 45}
                    r="3" fill="#A1A1AA" />
                </g>
              )}
            </svg>

            {/* Tooth number */}
            <span className={cn(
              "text-[10px] font-semibold leading-none transition-all duration-200 rounded-md px-1.5 py-0.5",
              isSelected 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground group-hover:text-foreground"
            )}>
              {number}
            </span>

            {/* Problem dot */}
            {isProblematic && !isMissing && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 z-10">
                <span className="animate-ping absolute h-full w-full rounded-full opacity-60" style={{ backgroundColor: config.glow }} />
                <span className="relative rounded-full h-2.5 w-2.5 border border-card" style={{ backgroundColor: config.glow }} />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover border-border shadow-xl rounded-lg px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full border border-border/50" 
              style={{ background: `linear-gradient(135deg, ${config.gradient.light}, ${config.gradient.dark})` }} />
            <div>
              <p className="font-semibold text-xs">Зуб {number}</p>
              <p className="text-[10px] text-muted-foreground">{config.emoji} {config.label}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Helper functions
const getToothType = (n: number, isChild: boolean = false): 'molar' | 'premolar' | 'canine' | 'incisor' => {
  const d = n % 10;
  if (isChild || n >= 51) {
    if (d >= 4) return 'molar';
    if (d === 3) return 'canine';
    return 'incisor';
  }
  if (d >= 6) return 'molar';
  if (d >= 4) return 'premolar';
  if (d === 3) return 'canine';
  return 'incisor';
};

const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

const YOUNG_UPPER_RIGHT = [17, 16, 15, 14, 13, 12, 11];
const YOUNG_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27];
const YOUNG_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37];
const YOUNG_LOWER_RIGHT = [47, 46, 45, 44, 43, 42, 41];

const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];
const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];

type DentitionType = 'child' | 'young' | 'adult';

const calculateAge = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 25;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const getDentitionType = (age: number): DentitionType => {
  if (age < 12) return 'child';
  if (age < 20) return 'young';
  return 'adult';
};

// Main component
export function UltraRealisticDentalChart({ patientId, birthDate }: { patientId?: string; birthDate?: string | null }) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const age = useMemo(() => calculateAge(birthDate), [birthDate]);
  const dentitionType = useMemo(() => getDentitionType(age), [age]);
  const isChild = dentitionType === 'child';

  const teethArrays = useMemo(() => {
    if (dentitionType === 'child') {
      return { upperRight: CHILD_UPPER_RIGHT, upperLeft: CHILD_UPPER_LEFT, lowerLeft: CHILD_LOWER_LEFT, lowerRight: CHILD_LOWER_RIGHT, totalTeeth: 20 };
    }
    if (dentitionType === 'young') {
      return { upperRight: YOUNG_UPPER_RIGHT, upperLeft: YOUNG_UPPER_LEFT, lowerLeft: YOUNG_LOWER_LEFT, lowerRight: YOUNG_LOWER_RIGHT, totalTeeth: 28 };
    }
    return { upperRight: ADULT_UPPER_RIGHT, upperLeft: ADULT_UPPER_LEFT, lowerLeft: ADULT_LOWER_LEFT, lowerRight: ADULT_LOWER_RIGHT, totalTeeth: 32 };
  }, [dentitionType]);

  const { data: teethData, isLoading } = useQuery({
    queryKey: ['patient-teeth-ultra', effectivePatientId],
    queryFn: async () => {
      if (!effectivePatientId) return [];
      const { data, error } = await supabase
        .from('patient_teeth_status')
        .select('*')
        .eq('patient_id', effectivePatientId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectivePatientId,
  });

  const teethMap = useMemo(() => {
    const map = new Map<number, any>();
    teethData?.forEach(tooth => map.set(tooth.tooth_number, tooth));
    return map;
  }, [teethData]);

  const getToothStatus = (n: number): ToothStatus => {
    return (teethMap.get(n)?.status as ToothStatus) || 'healthy';
  };

  const getToothData = (n: number) => teethMap.get(n);

  const problemCount = useMemo(() => {
    const allTeeth = [...teethArrays.upperRight, ...teethArrays.upperLeft, ...teethArrays.lowerLeft, ...teethArrays.lowerRight];
    return allTeeth.filter(n => STATUS_CONFIG[getToothStatus(n)].pulse).length;
  }, [teethArrays, teethMap]);

  const healthyCount = useMemo(() => {
    const allTeeth = [...teethArrays.upperRight, ...teethArrays.upperLeft, ...teethArrays.lowerLeft, ...teethArrays.lowerRight];
    return allTeeth.filter(n => getToothStatus(n) === 'healthy').length;
  }, [teethArrays, teethMap]);

  const handleToothClick = (n: number) => {
    setSelectedTooth(prev => prev === n ? null : n);
  };

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card">
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-48 w-full max-w-3xl" />
            <Skeleton className="h-48 w-full max-w-3xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderTeethRow = (teeth: number[], isUpper: boolean, side: 'left' | 'right') => (
    <div className={cn("flex items-end gap-0.5", side === 'left' ? 'flex-row-reverse' : 'flex-row')}>
      {teeth.map((n, i) => (
        <UltraRealistic3DTooth
          key={n} number={n} type={getToothType(n, isChild)} isUpper={isUpper}
          status={getToothStatus(n)} isSelected={selectedTooth === n}
          onClick={() => handleToothClick(n)} scale={zoom} animationDelay={i * 25}
        />
      ))}
    </div>
  );

  return (
    <Card className="border-border/50 bg-card overflow-hidden shadow-card">
      {/* Compact Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-foreground">Зубная формула</h3>
          
          {/* Stats pills */}
          <div className="hidden sm:flex items-center gap-2">
            <Badge variant="outline" className={cn(
              "gap-1 text-[11px] h-6 rounded-full font-medium",
              dentitionType === 'child' && "border-pink-500/30 text-pink-600 bg-pink-500/5",
              dentitionType === 'young' && "border-blue-500/30 text-blue-600 bg-blue-500/5",
              dentitionType === 'adult' && "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
            )}>
              {dentitionType === 'child' && <Baby className="w-3 h-3" />}
              {dentitionType === 'young' && <User className="w-3 h-3" />}
              {dentitionType === 'adult' && <Heart className="w-3 h-3" />}
              {age} лет
            </Badge>
            
            <span className="text-[11px] text-muted-foreground">
              {healthyCount}/{teethArrays.totalTeeth} здоровых
            </span>

            {problemCount > 0 && (
              <Badge className="gap-1 text-[11px] h-6 rounded-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15">
                <AlertTriangle className="w-3 h-3" />
                {problemCount}
              </Badge>
            )}
          </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/40">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(Math.max(0.7, zoom - 0.1))}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(1)}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setZoom(Math.min(1.3, zoom + 0.1))}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <CardContent className="p-6 pb-5">
        <div className="flex flex-col items-center gap-5">
          {/* Upper Jaw */}
          <div className="w-full">
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest text-center mb-2">Верхняя челюсть</p>
            <div className="relative mx-auto max-w-fit">
              <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-rose-100/10 to-transparent rounded-t-[80px] blur-lg" />
              <div className="flex justify-center gap-4 relative z-10">
                {renderTeethRow(teethArrays.upperRight, true, 'right')}
                <div className="w-px bg-border/30 self-stretch" />
                {renderTeethRow(teethArrays.upperLeft, true, 'left')}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full max-w-xl flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-border/40" />
            <span className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-wider">L · R</span>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-border/40" />
          </div>

          {/* Lower Jaw */}
          <div className="w-full">
            <div className="relative mx-auto max-w-fit">
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-rose-100/10 to-transparent rounded-b-[80px] blur-lg" />
              <div className="flex justify-center gap-4 relative z-10">
                {renderTeethRow(teethArrays.lowerRight, false, 'right')}
                <div className="w-px bg-border/30 self-stretch" />
                {renderTeethRow(teethArrays.lowerLeft, false, 'left')}
              </div>
            </div>
            <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-widest text-center mt-2">Нижняя челюсть</p>
          </div>

          {/* Legend - compact grid */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pt-3 border-t border-border/30 w-full">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dotColor }} />
                <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tooth detail */}
        {selectedTooth && (
          <div className="mt-6 pt-5 border-t border-border/30">
            <SmartToothDetailCard
              tooth={{
                tooth_number: selectedTooth,
                status: getToothStatus(selectedTooth),
                ...getToothData(selectedTooth)
              }}
              onClose={() => setSelectedTooth(null)}
              readOnly={false}
              patientId={effectivePatientId || ''}
            />
          </div>
        )}
      </CardContent>

      <style>{`
        .dental-tooth {
          animation: tooth-appear 0.4s ease-out backwards;
        }
        @keyframes tooth-appear {
          from { opacity: 0; transform: translateY(8px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </Card>
  );
}
