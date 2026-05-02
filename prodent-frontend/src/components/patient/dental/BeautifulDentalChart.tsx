import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Baby, User, Blend } from "lucide-react";
import { ToothDetailCard } from "./ToothDetailCard";
import { differenceInYears } from "date-fns";
import { cn } from "@/lib/utils";

type FormulaType = 'child' | 'adult' | 'mixed';
type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const STATUS_CONFIG: Record<ToothStatus, { gradient: string; label: string; ring?: string }> = {
  healthy: { gradient: 'from-[#E8E0F0] via-[#D8D0E8] to-[#C8C0D8]', label: 'Здоровый' },
  caries: { gradient: 'from-amber-300 via-amber-400 to-amber-500', label: 'Кариес', ring: 'ring-amber-400' },
  filling: { gradient: 'from-sky-300 via-sky-400 to-sky-500', label: 'Пломба', ring: 'ring-sky-400' },
  crown: { gradient: 'from-yellow-300 via-yellow-400 to-yellow-500', label: 'Коронка', ring: 'ring-yellow-400' },
  implant: { gradient: 'from-slate-300 via-slate-400 to-slate-500', label: 'Имплант', ring: 'ring-slate-400' },
  removed: { gradient: 'from-gray-200 via-gray-300 to-gray-400', label: 'Удалён' },
  watch: { gradient: 'from-orange-200 via-orange-300 to-orange-400', label: 'Наблюдение', ring: 'ring-orange-400' },
  endo: { gradient: 'from-rose-300 via-rose-400 to-rose-500', label: 'Эндодонтия', ring: 'ring-rose-400' },
  periodontitis: { gradient: 'from-red-300 via-red-400 to-red-500', label: 'Периодонтит', ring: 'ring-red-400' },
};

// Beautiful SVG tooth shapes
const ToothSVG = ({ 
  type, 
  isUpper, 
  status,
  isSelected,
  number
}: { 
  type: 'molar' | 'premolar' | 'canine' | 'incisor';
  isUpper: boolean;
  status: ToothStatus;
  isSelected: boolean;
  number: number;
}) => {
  const config = STATUS_CONFIG[status];
  const isMissing = status === 'removed';
  
  // Different tooth shapes based on type
  const getMolarPath = () => isUpper 
    ? "M6 4C3 4 1 8 1 14C1 20 2 28 6 32C8 34 14 34 16 32C20 28 21 20 21 14C21 8 19 4 16 4C14 4 8 4 6 4Z"
    : "M6 28C3 28 1 24 1 18C1 12 2 4 6 0C8 -2 14 -2 16 0C20 4 21 12 21 18C21 24 19 28 16 28C14 28 8 28 6 28Z";
    
  const getPremolarPath = () => isUpper
    ? "M5 3C2 3 1 7 1 12C1 17 2 24 5 27C7 28 11 28 13 27C16 24 17 17 17 12C17 7 16 3 13 3C11 3 7 3 5 3Z"
    : "M5 25C2 25 1 21 1 16C1 11 2 4 5 1C7 0 11 0 13 1C16 4 17 11 17 16C17 21 16 25 13 25C11 25 7 25 5 25Z";
    
  const getCaninePath = () => isUpper
    ? "M7 2C4 2 2 8 2 16C2 24 4 34 7 38C9 40 13 40 15 38C18 34 20 24 20 16C20 8 18 2 15 2C13 2 9 2 7 2Z"
    : "M7 36C4 36 2 30 2 22C2 14 4 4 7 0C9 -2 13 -2 15 0C18 4 20 14 20 22C20 30 18 36 15 36C13 36 9 36 7 36Z";
    
  const getIncisorPath = () => isUpper
    ? "M5 2C3 2 1 6 1 12C1 18 2 26 5 29C7 30 11 30 13 29C15 26 17 18 17 12C17 6 15 2 13 2C11 2 7 2 5 2Z"
    : "M5 27C3 27 1 23 1 17C1 11 2 3 5 0C7 -1 11 -1 13 0C15 3 17 11 17 17C17 23 15 27 13 27C11 27 7 27 5 27Z";

  const paths: Record<string, string> = {
    molar: getMolarPath(),
    premolar: getPremolarPath(),
    canine: getCaninePath(),
    incisor: getIncisorPath()
  };

  const sizes: Record<string, { w: number; h: number; vw: number; vh: number }> = {
    molar: { w: 32, h: 44, vw: 22, vh: 36 },
    premolar: { w: 26, h: 38, vw: 18, vh: 28 },
    canine: { w: 28, h: 52, vw: 22, vh: 40 },
    incisor: { w: 24, h: 40, vw: 18, vh: 30 }
  };

  const size = sizes[type];
  const gradientId = `gradient-${number}`;
  const highlightId = `highlight-${number}`;

  return (
    <svg 
      width={size.w} 
      height={size.h} 
      viewBox={`0 0 ${size.vw} ${size.vh}`}
      className={cn(
        "transition-all duration-300 ease-out",
        isMissing && "opacity-30"
      )}
    >
      <defs>
        {/* Main gradient */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className={`stop-color-[#E8E0F0]`} style={{ stopColor: status === 'healthy' ? '#EDE8F5' : undefined }} />
          <stop offset="50%" className={`stop-color-[#D8D0E8]`} style={{ stopColor: status === 'healthy' ? '#DCD4EC' : undefined }} />
          <stop offset="100%" className={`stop-color-[#C8C0D8]`} style={{ stopColor: status === 'healthy' ? '#CBC4E0' : undefined }} />
        </linearGradient>
        
        {/* Highlight gradient */}
        <linearGradient id={highlightId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="30%" stopColor="white" stopOpacity="0.2" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </linearGradient>

        {/* Shadow filter */}
        <filter id={`shadow-${number}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15"/>
        </filter>
      </defs>
      
      {/* Main tooth */}
      <path
        d={paths[type]}
        className={cn(
          "transition-all duration-300",
          status === 'healthy' 
            ? 'fill-[#DDD5EA]' 
            : `bg-gradient-to-br ${config.gradient}`,
          isSelected && "stroke-primary stroke-[2px]"
        )}
        fill={status === 'healthy' ? '#DDD5EA' : undefined}
        stroke={isSelected ? 'hsl(var(--primary))' : '#B8B0C8'}
        strokeWidth={isSelected ? 2 : 0.8}
        filter={`url(#shadow-${number})`}
      />
      
      {/* Inner highlight */}
      <path
        d={paths[type]}
        fill={`url(#${highlightId})`}
        className="pointer-events-none"
      />

      {/* Root details for upper teeth */}
      {isUpper && (
        <g stroke="#C0B8D0" strokeWidth="0.5" opacity="0.5">
          {type === 'molar' && (
            <>
              <path d="M7 24 Q6 30 5 34" fill="none" />
              <path d="M11 24 Q11 30 11 34" fill="none" />
              <path d="M15 24 Q16 30 17 34" fill="none" />
            </>
          )}
          {type === 'premolar' && (
            <>
              <path d="M6 20 Q5 24 5 27" fill="none" />
              <path d="M12 20 Q13 24 13 27" fill="none" />
            </>
          )}
          {type === 'canine' && (
            <path d="M11 28 Q11 34 11 38" fill="none" />
          )}
          {type === 'incisor' && (
            <path d="M9 22 Q9 26 9 29" fill="none" />
          )}
        </g>
      )}

      {/* Crown decoration */}
      {status === 'crown' && (
        <path
          d={paths[type]}
          fill="none"
          stroke="#D4A520"
          strokeWidth="1.5"
          strokeDasharray="2,1"
          opacity="0.7"
        />
      )}
    </svg>
  );
};

// Tooth wrapper with interactions
const Tooth = ({
  number,
  type,
  isUpper,
  status,
  isSelected,
  onClick,
  delay
}: {
  number: number;
  type: 'molar' | 'premolar' | 'canine' | 'incisor';
  isUpper: boolean;
  status: ToothStatus;
  isSelected: boolean;
  onClick: () => void;
  delay: number;
}) => {
  const config = STATUS_CONFIG[status];
  const isProblematic = ['caries', 'endo', 'periodontitis'].includes(status);
  const isMissing = status === 'removed';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            style={{ animationDelay: `${delay}ms` }}
            className={cn(
              "tooth-item relative flex flex-col items-center",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-1.5 hover:scale-105",
              isSelected && "scale-110 -translate-y-2 z-20",
              isMissing && "cursor-default"
            )}
          >
            <ToothSVG 
              type={type} 
              isUpper={isUpper} 
              status={status}
              isSelected={isSelected}
              number={number}
            />
            
            {/* Tooth number */}
            <span className={cn(
              "text-[10px] font-medium mt-1 transition-colors",
              isSelected ? "text-primary" : "text-muted-foreground"
            )}>
              {number}
            </span>

            {/* Problem indicator */}
            {isProblematic && !isMissing && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-10">
                <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card/95 backdrop-blur border-border/50">
          <p className="font-medium text-sm">Зуб {number}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Get tooth type from number
const getToothType = (num: number): 'molar' | 'premolar' | 'canine' | 'incisor' => {
  const digit = num % 10;
  if (digit >= 6) return 'molar';
  if (digit >= 4) return 'premolar';
  if (digit === 3) return 'canine';
  return 'incisor';
};

// Adult teeth arrays
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

interface BeautifulDentalChartProps {
  patientId?: string;
  birthDate?: string | null;
}

export function BeautifulDentalChart({ patientId, birthDate }: BeautifulDentalChartProps) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const patientAge = useMemo(() => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  }, [birthDate]);

  const [formulaType, setFormulaType] = useState<FormulaType>('adult');
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'planning' | 'history'>('planning');

  const { data: teethData, isLoading } = useQuery({
    queryKey: ['teeth-beautiful', effectivePatientId],
    queryFn: async () => {
      if (!effectivePatientId) return [];
      const { data } = await supabase
        .from('patient_teeth_status')
        .select('*, doctors:doctor_id(user_id, profiles:user_id(full_name))')
        .eq('patient_id', effectivePatientId);
      return data || [];
    },
    enabled: !!effectivePatientId,
  });

  const teethMap = useMemo(() => {
    const map = new Map<number, any>();
    teethData?.forEach(t => map.set(t.tooth_number, { ...t, doctor_name: t.doctors?.profiles?.full_name }));
    return map;
  }, [teethData]);

  const getStatus = (n: number): ToothStatus => teethMap.get(n)?.status || 'healthy';

  const getToothData = (n: number) => ({
    tooth_number: n,
    status: teethMap.get(n)?.status || 'healthy',
    notes: teethMap.get(n)?.notes,
    images: teethMap.get(n)?.images,
    materials: teethMap.get(n)?.materials,
    recommendations: teethMap.get(n)?.recommendations,
    doctor_name: teethMap.get(n)?.doctor_name,
    updated_at: teethMap.get(n)?.updated_at,
  });

  const problemCount = useMemo(() => 
    teethData?.filter(t => !['healthy', 'filling', 'crown', 'implant'].includes(t.status)).length || 0
  , [teethData]);

  const renderTeethRow = (teeth: number[], isUpper: boolean, baseDelay: number) => (
    <div className="flex items-end gap-0.5">
      {teeth.map((num, i) => (
        <Tooth
          key={num}
          number={num}
          type={getToothType(num)}
          isUpper={isUpper}
          status={getStatus(num)}
          isSelected={selectedTooth === num}
          onClick={() => setSelectedTooth(selectedTooth === num ? null : num)}
          delay={baseDelay + i * 30}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-border/30">
        <CardContent className="p-8">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-card bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Chart</h2>
          {problemCount > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50">
              {problemCount} issues
            </Badge>
          )}
        </div>
        
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="h-8 bg-muted/40">
            <TabsTrigger value="planning" className="text-xs h-7 px-3">Planning</TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7 px-3">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Formula switcher */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-muted/30 rounded-lg gap-1">
            {[
              { key: 'child', icon: Baby, label: 'Child' },
              { key: 'adult', icon: User, label: 'Adult' },
              { key: 'mixed', icon: Blend, label: 'Mixed' },
            ].map(({ key, icon: Icon, label }) => (
              <Button
                key={key}
                size="sm"
                variant={formulaType === key ? 'default' : 'ghost'}
                onClick={() => setFormulaType(key as FormulaType)}
                className="h-7 px-3 gap-1.5 text-xs"
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Dental Chart */}
        <div className="relative bg-gradient-to-b from-muted/20 to-transparent rounded-2xl p-6 pt-8 pb-10">
          {/* Upper jaw */}
          <div className="flex justify-center gap-4">
            {renderTeethRow(UPPER_RIGHT, true, 0)}
            <div className="w-2" />
            {renderTeethRow(UPPER_LEFT, true, 240)}
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 py-0.5 text-xs text-muted-foreground rounded-full border border-border/50">
              32 teeth
            </div>
          </div>

          {/* Lower jaw */}
          <div className="flex justify-center gap-4">
            {renderTeethRow(LOWER_RIGHT, false, 480)}
            <div className="w-2" />
            {renderTeethRow(LOWER_LEFT, false, 720)}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, { label }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn(
                "w-3 h-3 rounded-sm",
                key === 'healthy' && "bg-[#DDD5EA]",
                key === 'caries' && "bg-amber-400",
                key === 'filling' && "bg-sky-400",
                key === 'crown' && "bg-yellow-400",
                key === 'implant' && "bg-slate-400",
                key === 'removed' && "bg-gray-300",
              )} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Selected tooth detail */}
        {selectedTooth && (
          <div className="mt-4 animate-fade-in">
            <ToothDetailCard
              tooth={getToothData(selectedTooth)}
              isChild={false}
              onClose={() => setSelectedTooth(null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
