import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Baby, User, Blend } from "lucide-react";
import { SmartToothDetailCard } from "./SmartToothDetailCard";
import { cn } from "@/lib/utils";

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const STATUS_CONFIG: Record<ToothStatus, { label: string; baseColor: string; darkColor: string }> = {
  healthy: { label: 'Здоровый', baseColor: '#E8E0F5', darkColor: '#C5BAD8' },
  caries: { label: 'Кариес', baseColor: '#FCD34D', darkColor: '#B45309' },
  filling: { label: 'Пломба', baseColor: '#93C5FD', darkColor: '#1E40AF' },
  crown: { label: 'Коронка', baseColor: '#FDE68A', darkColor: '#A16207' },
  implant: { label: 'Имплант', baseColor: '#CBD5E1', darkColor: '#475569' },
  removed: { label: 'Удалён', baseColor: '#E5E7EB', darkColor: '#9CA3AF' },
  watch: { label: 'Наблюдение', baseColor: '#FDBA74', darkColor: '#C2410C' },
  endo: { label: 'Эндодонтия', baseColor: '#FCA5A5', darkColor: '#B91C1C' },
  periodontitis: { label: 'Периодонтит', baseColor: '#F87171', darkColor: '#991B1B' },
};

// Realistic crown-only tooth SVG (no roots visible)
const RealisticCrownTooth = ({ 
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
  const id = `tooth-${number}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get realistic crown shapes - only visible part of the tooth
  const getCrownData = () => {
    if (type === 'molar') {
      return {
        width: 56,
        height: 48,
        viewBox: "0 0 42 36",
        // Realistic molar crown with 4-5 cusps
        crown: isUpper 
          ? `M4 28 
             C2 24 2 18 4 12 
             C6 6 10 3 14 2 
             C18 1 24 1 28 2 
             C32 3 36 6 38 12 
             C40 18 40 24 38 28 
             C36 32 32 35 28 35 
             C24 36 18 36 14 35 
             C10 35 6 32 4 28Z`
          : `M4 8 
             C2 12 2 18 4 24 
             C6 30 10 33 14 34 
             C18 35 24 35 28 34 
             C32 33 36 30 38 24 
             C40 18 40 12 38 8 
             C36 4 32 1 28 1 
             C24 0 18 0 14 1 
             C10 1 6 4 4 8Z`,
        // Occlusal surface with realistic fissure pattern
        fissures: [
          `M12 ${isUpper ? 14 : 22} Q17 ${isUpper ? 10 : 26} 21 ${isUpper ? 12 : 24} Q25 ${isUpper ? 10 : 26} 30 ${isUpper ? 14 : 22}`,
          `M16 ${isUpper ? 18 : 18} Q21 ${isUpper ? 14 : 22} 26 ${isUpper ? 18 : 18}`,
          `M21 ${isUpper ? 12 : 24} L21 ${isUpper ? 18 : 18}`
        ],
        cusps: isUpper ? [
          { cx: 12, cy: 10 }, { cx: 30, cy: 10 },
          { cx: 10, cy: 22 }, { cx: 32, cy: 22 },
          { cx: 21, cy: 16 }
        ] : [
          { cx: 12, cy: 26 }, { cx: 30, cy: 26 },
          { cx: 10, cy: 14 }, { cx: 32, cy: 14 }
        ],
        ridges: [
          { x1: 8, y1: isUpper ? 16 : 20, x2: 14, y2: isUpper ? 16 : 20 },
          { x1: 28, y1: isUpper ? 16 : 20, x2: 34, y2: isUpper ? 16 : 20 }
        ]
      };
    }
    
    if (type === 'premolar') {
      return {
        width: 44,
        height: 44,
        viewBox: "0 0 32 32",
        crown: isUpper 
          ? `M4 24 
             C2 20 2 14 4 10 
             C6 5 9 2 12 2 
             C16 1 20 1 24 4 
             C27 7 29 12 28 18 
             C28 24 25 28 20 29 
             C16 30 10 29 6 27 
             C4 26 3 25 4 24Z`
          : `M4 8 
             C2 12 2 18 4 22 
             C6 27 9 30 12 30 
             C16 31 20 31 24 28 
             C27 25 29 20 28 14 
             C28 8 25 4 20 3 
             C16 2 10 3 6 5 
             C4 6 3 7 4 8Z`,
        fissures: [
          `M10 ${isUpper ? 14 : 18} Q16 ${isUpper ? 10 : 22} 22 ${isUpper ? 14 : 18}`
        ],
        cusps: isUpper ? [
          { cx: 10, cy: 10 }, { cx: 22, cy: 10 }
        ] : [
          { cx: 10, cy: 22 }, { cx: 22, cy: 22 }
        ],
        ridges: []
      };
    }
    
    if (type === 'canine') {
      return {
        width: 38,
        height: 48,
        viewBox: "0 0 28 36",
        // Pointed canine with single cusp
        crown: isUpper 
          ? `M6 28 
             C3 24 3 18 5 12 
             C7 6 10 2 14 1 
             C18 2 21 6 23 12 
             C25 18 25 24 22 28 
             C20 32 18 34 16 35 
             C14 35 12 35 10 34 
             C8 33 6 31 6 28Z`
          : `M6 8 
             C3 12 3 18 5 24 
             C7 30 10 34 14 35 
             C18 34 21 30 23 24 
             C25 18 25 12 22 8 
             C20 4 18 2 16 1 
             C14 1 12 1 10 2 
             C8 3 6 5 6 8Z`,
        fissures: [],
        cusps: isUpper ? [
          { cx: 14, cy: 6 }
        ] : [
          { cx: 14, cy: 30 }
        ],
        ridges: [
          { x1: 8, y1: isUpper ? 12 : 24, x2: 14, y2: isUpper ? 6 : 30 },
          { x1: 20, y1: isUpper ? 12 : 24, x2: 14, y2: isUpper ? 6 : 30 }
        ]
      };
    }
    
    // Incisor - flat, shovel-shaped
    return {
      width: 32,
      height: 40,
      viewBox: "0 0 24 30",
      crown: isUpper 
        ? `M5 24 
           C3 20 3 14 5 10 
           C6 6 8 3 12 2 
           C16 3 18 6 19 10 
           C21 14 21 20 19 24 
           C18 27 16 29 14 29 
           C12 30 10 29 8 28 
           C6 27 5 26 5 24Z`
        : `M5 6 
           C3 10 3 16 5 20 
           C6 24 8 27 12 28 
           C16 27 18 24 19 20 
           C21 16 21 10 19 6 
           C18 3 16 1 14 1 
           C12 0 10 1 8 2 
           C6 3 5 4 5 6Z`,
      fissures: [],
      cusps: [],
      ridges: [
        // Incisal edge
        { x1: 7, y1: isUpper ? 26 : 4, x2: 17, y2: isUpper ? 26 : 4 }
      ]
    };
  };

  const crownData = getCrownData();

  // Dynamic colors based on status
  const getToothColors = () => {
    if (status === 'healthy') {
      return {
        enamelLight: '#FFFFFF',
        enamelMid: '#F8F6FA',
        enamelDark: '#E8E2F0',
        shadow: '#C8C0D8'
      };
    }
    return {
      enamelLight: '#FFFFFF',
      enamelMid: config.baseColor,
      enamelDark: config.darkColor,
      shadow: config.darkColor
    };
  };

  const colors = getToothColors();

  return (
    <svg 
      width={crownData.width} 
      height={crownData.height}
      viewBox={crownData.viewBox}
      className={cn(
        "transition-all duration-300",
        isMissing && "opacity-15"
      )}
    >
      <defs>
        {/* Realistic enamel gradient - pearl-like appearance */}
        <linearGradient id={`${id}-enamel`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor={colors.enamelLight} />
          <stop offset="15%" stopColor={colors.enamelLight} stopOpacity="0.98" />
          <stop offset="40%" stopColor={colors.enamelMid} />
          <stop offset="70%" stopColor={colors.enamelDark} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors.shadow} stopOpacity="0.7" />
        </linearGradient>

        {/* Top shine highlight */}
        <linearGradient id={`${id}-shine`} x1="30%" y1="0%" x2="70%" y2="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.9" />
          <stop offset="25%" stopColor="white" stopOpacity="0.6" />
          <stop offset="50%" stopColor="white" stopOpacity="0.2" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Inner depth/shadow */}
        <radialGradient id={`${id}-depth`} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="65%" stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.12" />
        </radialGradient>

        {/* Occlusal surface shadow for depth */}
        <radialGradient id={`${id}-occlusal`} cx="50%" cy={isUpper ? "40%" : "60%"} r="40%">
          <stop offset="0%" stopColor="#A09090" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        {/* Drop shadow */}
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.15"/>
        </filter>

        {/* Selected glow */}
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Crown base with enamel */}
      <path
        d={crownData.crown}
        fill={`url(#${id}-enamel)`}
        stroke={isSelected ? 'hsl(175, 82%, 32%)' : '#C8C0D0'}
        strokeWidth={isSelected ? 2.5 : 1}
        filter={isSelected ? `url(#${id}-glow)` : `url(#${id}-shadow)`}
        className="tooth-crown"
      />

      {/* Depth overlay for 3D effect */}
      <path
        d={crownData.crown}
        fill={`url(#${id}-depth)`}
        className="pointer-events-none"
      />
      
      {/* Shine highlight */}
      <path
        d={crownData.crown}
        fill={`url(#${id}-shine)`}
        className="pointer-events-none"
      />

      {/* Occlusal surface darkening */}
      <path
        d={crownData.crown}
        fill={`url(#${id}-occlusal)`}
        className="pointer-events-none"
      />

      {/* Fissures for molars and premolars */}
      {crownData.fissures.length > 0 && (
        <g className="fissures">
          {crownData.fissures.map((fissure, i) => (
            <path
              key={i}
              d={fissure}
              fill="none"
              stroke="#9A8A8A"
              strokeWidth="1"
              strokeOpacity="0.5"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {/* Cusp highlights */}
      {crownData.cusps.map((cusp, i) => (
        <circle
          key={i}
          cx={cusp.cx}
          cy={cusp.cy}
          r="2.5"
          fill="white"
          fillOpacity="0.4"
        />
      ))}

      {/* Ridge lines for canines and incisors */}
      {crownData.ridges.map((ridge, i) => (
        <line
          key={i}
          x1={ridge.x1}
          y1={ridge.y1}
          x2={ridge.x2}
          y2={ridge.y2}
          stroke="white"
          strokeWidth="1"
          strokeOpacity="0.25"
          strokeLinecap="round"
        />
      ))}

      {/* Status-specific overlays */}
      {status === 'crown' && (
        <>
          <path
            d={crownData.crown}
            fill="none"
            stroke="#DAA520"
            strokeWidth="2.5"
            strokeDasharray="4,2"
            opacity="0.8"
          />
        </>
      )}

      {status === 'implant' && (
        <g>
          <circle 
            cx={crownData.width / 2} 
            cy={crownData.height / 2} 
            r="4" 
            fill="#71717A" 
            opacity="0.4"
          />
          <path
            d={crownData.crown}
            fill="none"
            stroke="#71717A"
            strokeWidth="1.5"
            strokeDasharray="2,2"
            opacity="0.6"
          />
        </g>
      )}

      {status === 'filling' && (
        <ellipse
          cx={crownData.width / 2}
          cy={crownData.height / 2}
          rx={type === 'molar' ? 7 : 5}
          ry={type === 'molar' ? 6 : 4}
          fill="#94A3B8"
          opacity="0.75"
          stroke="#64748B"
          strokeWidth="0.5"
        />
      )}

      {status === 'caries' && (
        <ellipse
          cx={crownData.width / 2}
          cy={crownData.height / 2}
          rx={type === 'molar' ? 6 : 4}
          ry={type === 'molar' ? 5 : 3}
          fill="#7C2D12"
          opacity="0.75"
        />
      )}
    </svg>
  );
};

// Tooth wrapper
const Tooth = ({
  number, type, isUpper, status, isSelected, onClick, delay
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
              "real-tooth relative flex flex-col items-center gap-1",
              "transition-all duration-300 ease-out",
              "hover:-translate-y-2 hover:scale-110",
              isSelected && "scale-115 -translate-y-3 z-20",
              isMissing && "cursor-default hover:scale-100 hover:translate-y-0"
            )}
          >
            <RealisticCrownTooth 
              type={type} 
              isUpper={isUpper} 
              status={status}
              isSelected={isSelected}
              number={number}
            />
            
            <span className={cn(
              "flex items-center justify-center w-7 h-7 text-[11px] font-semibold transition-all duration-200",
              "rounded-full",
              isSelected 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" 
                : "bg-muted/80 text-muted-foreground hover:bg-primary/20 hover:text-primary"
            )}>
              {number}
            </span>

            {isProblematic && !isMissing && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 z-10">
                <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card/95 backdrop-blur border-border/50 shadow-lg">
          <p className="font-medium text-sm">Зуб {number}</p>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const getToothType = (n: number, isChild: boolean = false): 'molar' | 'premolar' | 'canine' | 'incisor' => {
  const d = n % 10;
  // Детские зубы (5x-8x) не имеют премоляров
  if (isChild || n >= 51) {
    if (d >= 4) return 'molar'; // 54, 55, 64, 65, 74, 75, 84, 85 - молочные моляры
    if (d === 3) return 'canine';
    return 'incisor';
  }
  if (d >= 6) return 'molar';
  if (d >= 4) return 'premolar';
  if (d === 3) return 'canine';
  return 'incisor';
};

// Взрослые зубы (32 зуба с зубами мудрости)
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

// Молодые (до 20 лет) - 28 зубов без зубов мудрости
const YOUNG_UPPER_RIGHT = [17, 16, 15, 14, 13, 12, 11];
const YOUNG_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27];
const YOUNG_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37];
const YOUNG_LOWER_RIGHT = [47, 46, 45, 44, 43, 42, 41];

// Детские зубы (до 12 лет) - 20 молочных зубов
const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];
const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];

type DentitionType = 'child' | 'young' | 'adult';

const calculateAge = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 25; // по умолчанию взрослый
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

const getDentitionType = (age: number): DentitionType => {
  if (age < 12) return 'child';
  if (age < 20) return 'young';
  return 'adult';
};

export function RealTeethChart({ patientId, birthDate }: { patientId?: string; birthDate?: string | null }) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'planning' | 'history'>('planning');

  // Определяем возраст и тип зубной формулы
  const age = useMemo(() => calculateAge(birthDate), [birthDate]);
  const dentitionType = useMemo(() => getDentitionType(age), [age]);
  const isChild = dentitionType === 'child';

  // Получаем правильные массивы зубов в зависимости от возраста
  const teethArrays = useMemo(() => {
    if (dentitionType === 'child') {
      return {
        upperRight: CHILD_UPPER_RIGHT,
        upperLeft: CHILD_UPPER_LEFT,
        lowerLeft: CHILD_LOWER_LEFT,
        lowerRight: CHILD_LOWER_RIGHT,
        totalTeeth: 20,
        label: 'Молочные зубы'
      };
    }
    if (dentitionType === 'young') {
      return {
        upperRight: YOUNG_UPPER_RIGHT,
        upperLeft: YOUNG_UPPER_LEFT,
        lowerLeft: YOUNG_LOWER_LEFT,
        lowerRight: YOUNG_LOWER_RIGHT,
        totalTeeth: 28,
        label: '28 зубов'
      };
    }
    return {
      upperRight: ADULT_UPPER_RIGHT,
      upperLeft: ADULT_UPPER_LEFT,
      lowerLeft: ADULT_LOWER_LEFT,
      lowerRight: ADULT_LOWER_RIGHT,
      totalTeeth: 32,
      label: '32 зуба'
    };
  }, [dentitionType]);

  const { data: teethData, isLoading } = useQuery({
    queryKey: ['real-teeth', effectivePatientId],
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
    const m = new Map<number, any>();
    teethData?.forEach(t => m.set(t.tooth_number, { ...t, doctor_name: t.doctors?.profiles?.full_name }));
    return m;
  }, [teethData]);

  const getStatus = (n: number): ToothStatus => teethMap.get(n)?.status || 'healthy';
  const getToothData = (n: number) => ({ tooth_number: n, ...teethMap.get(n) });

  const problemCount = teethData?.filter(t => !['healthy', 'filling', 'crown', 'implant'].includes(t.status)).length || 0;

  const renderRow = (teeth: number[], isUpper: boolean, baseDelay: number) => (
    <div className={cn("flex gap-0", !isUpper && "items-start", isUpper && "items-end")}>
      {teeth.map((n, i) => (
        <Tooth
          key={n}
          number={n}
          type={getToothType(n, isChild)}
          isUpper={isUpper}
          status={getStatus(n)}
          isSelected={selectedTooth === n}
          onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
          delay={baseDelay + i * 35}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return <Card className="border-border/30"><CardContent className="p-8"><Skeleton className="h-72 w-full" /></CardContent></Card>;
  }

  // Для детской формулы используем упрощённый рендер
  if (dentitionType === 'child') {
    return (
      <Card className="border-border/30 shadow-card bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-pink-500" />
              <h2 className="text-lg font-semibold">Молочные зубы</h2>
            </div>
            <Badge variant="outline" className="border-pink-500/50 text-pink-600 bg-pink-50 dark:bg-pink-950/30">
              {age} лет • 20 зубов
            </Badge>
            {problemCount > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                {problemCount} проблем
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Детская зубная формула - простой горизонтальный ряд */}
          <div className="flex flex-col items-center gap-6">
            {/* Верхняя челюсть */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Верхняя челюсть</p>
              <div className="flex justify-center gap-1">
                {renderRow(teethArrays.upperRight, true, 0)}
                <div className="w-4" />
                {renderRow(teethArrays.upperLeft, true, 175)}
              </div>
            </div>
            
            {/* Нижняя челюсть */}
            <div className="text-center">
              <div className="flex justify-center gap-1">
                {renderRow(teethArrays.lowerRight, false, 350)}
                <div className="w-4" />
                {renderRow(teethArrays.lowerLeft, false, 525)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Нижняя челюсть</p>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2 border-t border-border/30">
            {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, { label, baseColor }]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: baseColor }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Selected tooth */}
          {selectedTooth && (
            <div className="mt-4 animate-fade-in">
              <SmartToothDetailCard 
                tooth={getToothData(selectedTooth)} 
                patientId={effectivePatientId!}
                isChild={true} 
                readOnly={true}
                onClose={() => setSelectedTooth(null)} 
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-card bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {dentitionType === 'young' ? (
              <Blend className="h-5 w-5 text-blue-500" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
            <h2 className="text-lg font-semibold">Зубная формула</h2>
          </div>
          <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5">
            {age} лет • {teethArrays.totalTeeth} зуба
          </Badge>
          {problemCount > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
              {problemCount} проблем
            </Badge>
          )}
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="h-8 bg-muted/40">
            <TabsTrigger value="planning" className="text-xs h-7 px-3">Планирование</TabsTrigger>
            <TabsTrigger value="history" className="text-xs h-7 px-3">История</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* Realistic Jaw Dental Chart */}
        <div className="relative rounded-2xl py-8 px-4 overflow-hidden">
          <svg 
            viewBox="0 0 660 440" 
            className="w-full max-w-3xl mx-auto"
            style={{ minHeight: 420 }}
          >
            <defs>
              {/* Gum gradient - realistic pink gum tissue */}
              <linearGradient id="gumGradientUpper" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFB5B5" />
                <stop offset="30%" stopColor="#E8A0A0" />
                <stop offset="60%" stopColor="#D88E8E" />
                <stop offset="100%" stopColor="#CC8080" />
              </linearGradient>
              <linearGradient id="gumGradientLower" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#FFB5B5" />
                <stop offset="30%" stopColor="#E8A0A0" />
                <stop offset="60%" stopColor="#D88E8E" />
                <stop offset="100%" stopColor="#CC8080" />
              </linearGradient>
              {/* Gum inner shadow */}
              <radialGradient id="gumInnerShadow" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="transparent" />
                <stop offset="100%" stopColor="#B06060" stopOpacity="0.3" />
              </radialGradient>
              {/* Lip/mouth background */}
              <radialGradient id="mouthBg" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#3D1A1A" />
                <stop offset="70%" stopColor="#2A1010" />
                <stop offset="100%" stopColor="#1A0808" />
              </radialGradient>
              {/* Gum texture highlight */}
              <filter id="gumTexture">
                <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise"/>
                <feDiffuseLighting in="noise" lightingColor="#FFD0D0" surfaceScale="1" result="light">
                  <feDistantLight azimuth="45" elevation="60"/>
                </feDiffuseLighting>
                <feComposite in="SourceGraphic" in2="light" operator="multiply"/>
              </filter>
              {/* Jaw shadow */}
              <filter id="jawShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.25"/>
              </filter>
            </defs>

            {/* Dark mouth/throat background */}
            <ellipse 
              cx="330" cy="220" 
              rx="240" ry="160" 
              fill="url(#mouthBg)"
              opacity="0.6"
            />

            {/* Upper Jaw (Maxilla) */}
            <g filter="url(#jawShadow)">
              {/* Upper gum tissue - U-shaped arch - wider */}
              <path 
                d="M50 180 
                   Q50 40 330 30 
                   Q610 40 610 180 
                   Q610 215 585 215
                   Q560 110 330 100
                   Q100 110 75 215
                   Q50 215 50 180Z"
                fill="url(#gumGradientUpper)"
              />
              {/* Gum ridge detail */}
              <path 
                d="M75 190 
                   Q75 70 330 60 
                   Q585 70 585 190"
                fill="none"
                stroke="#C07070"
                strokeWidth="2"
                opacity="0.4"
              />
              {/* Gum highlight */}
              <path 
                d="M120 145 
                   Q120 85 330 75 
                   Q540 85 540 145"
                fill="none"
                stroke="#FFD5D5"
                strokeWidth="3"
                opacity="0.5"
                strokeLinecap="round"
              />
            </g>

            {/* Upper teeth positioned along the arch */}
            <g className="upper-teeth">
              {/* Right side (18-11) - зуб 18 только для взрослых */}
              {dentitionType === 'adult' && (
                <foreignObject x="60" y="125" width="56" height="85">
                  <div className="flex justify-center">
                    <Tooth number={18} type="molar" isUpper={true} status={getStatus(18)} 
                      isSelected={selectedTooth === 18} onClick={() => setSelectedTooth(selectedTooth === 18 ? null : 18)} delay={0} />
                  </div>
                </foreignObject>
              )}
              <foreignObject x="105" y="105" width="56" height="85">
                <div className="flex justify-center">
                  <Tooth number={17} type="molar" isUpper={true} status={getStatus(17)} 
                    isSelected={selectedTooth === 17} onClick={() => setSelectedTooth(selectedTooth === 17 ? null : 17)} delay={35} />
                </div>
              </foreignObject>
              <foreignObject x="148" y="88" width="56" height="80">
                <div className="flex justify-center">
                  <Tooth number={16} type="molar" isUpper={true} status={getStatus(16)} 
                    isSelected={selectedTooth === 16} onClick={() => setSelectedTooth(selectedTooth === 16 ? null : 16)} delay={70} />
                </div>
              </foreignObject>
              <foreignObject x="188" y="75" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={15} type="premolar" isUpper={true} status={getStatus(15)} 
                    isSelected={selectedTooth === 15} onClick={() => setSelectedTooth(selectedTooth === 15 ? null : 15)} delay={105} />
                </div>
              </foreignObject>
              <foreignObject x="222" y="68" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={14} type="premolar" isUpper={true} status={getStatus(14)} 
                    isSelected={selectedTooth === 14} onClick={() => setSelectedTooth(selectedTooth === 14 ? null : 14)} delay={140} />
                </div>
              </foreignObject>
              <foreignObject x="255" y="62" width="40" height="78">
                <div className="flex justify-center">
                  <Tooth number={13} type="canine" isUpper={true} status={getStatus(13)} 
                    isSelected={selectedTooth === 13} onClick={() => setSelectedTooth(selectedTooth === 13 ? null : 13)} delay={175} />
                </div>
              </foreignObject>
              <foreignObject x="285" y="56" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={12} type="incisor" isUpper={true} status={getStatus(12)} 
                    isSelected={selectedTooth === 12} onClick={() => setSelectedTooth(selectedTooth === 12 ? null : 12)} delay={210} />
                </div>
              </foreignObject>
              <foreignObject x="310" y="52" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={11} type="incisor" isUpper={true} status={getStatus(11)} 
                    isSelected={selectedTooth === 11} onClick={() => setSelectedTooth(selectedTooth === 11 ? null : 11)} delay={245} />
                </div>
              </foreignObject>

              {/* Left side (21-28) */}
              <foreignObject x="335" y="52" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={21} type="incisor" isUpper={true} status={getStatus(21)} 
                    isSelected={selectedTooth === 21} onClick={() => setSelectedTooth(selectedTooth === 21 ? null : 21)} delay={280} />
                </div>
              </foreignObject>
              <foreignObject x="360" y="56" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={22} type="incisor" isUpper={true} status={getStatus(22)} 
                    isSelected={selectedTooth === 22} onClick={() => setSelectedTooth(selectedTooth === 22 ? null : 22)} delay={315} />
                </div>
              </foreignObject>
              <foreignObject x="385" y="62" width="40" height="78">
                <div className="flex justify-center">
                  <Tooth number={23} type="canine" isUpper={true} status={getStatus(23)} 
                    isSelected={selectedTooth === 23} onClick={() => setSelectedTooth(selectedTooth === 23 ? null : 23)} delay={350} />
                </div>
              </foreignObject>
              <foreignObject x="415" y="68" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={24} type="premolar" isUpper={true} status={getStatus(24)} 
                    isSelected={selectedTooth === 24} onClick={() => setSelectedTooth(selectedTooth === 24 ? null : 24)} delay={385} />
                </div>
              </foreignObject>
              <foreignObject x="450" y="75" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={25} type="premolar" isUpper={true} status={getStatus(25)} 
                    isSelected={selectedTooth === 25} onClick={() => setSelectedTooth(selectedTooth === 25 ? null : 25)} delay={420} />
                </div>
              </foreignObject>
              <foreignObject x="485" y="88" width="56" height="80">
                <div className="flex justify-center">
                  <Tooth number={26} type="molar" isUpper={true} status={getStatus(26)} 
                    isSelected={selectedTooth === 26} onClick={() => setSelectedTooth(selectedTooth === 26 ? null : 26)} delay={455} />
                </div>
              </foreignObject>
              <foreignObject x="528" y="105" width="56" height="85">
                <div className="flex justify-center">
                  <Tooth number={27} type="molar" isUpper={true} status={getStatus(27)} 
                    isSelected={selectedTooth === 27} onClick={() => setSelectedTooth(selectedTooth === 27 ? null : 27)} delay={490} />
                </div>
              </foreignObject>
              {dentitionType === 'adult' && (
                <foreignObject x="570" y="125" width="56" height="85">
                  <div className="flex justify-center">
                    <Tooth number={28} type="molar" isUpper={true} status={getStatus(28)} 
                      isSelected={selectedTooth === 28} onClick={() => setSelectedTooth(selectedTooth === 28 ? null : 28)} delay={525} />
                  </div>
                </foreignObject>
              )}
            </g>

            {/* Center label */}
            <g>
              <rect x="300" y="205" width="60" height="20" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.9"/>
              <text x="330" y="219" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontWeight="500">FDI • {teethArrays.totalTeeth}</text>
            </g>

            {/* Lower Jaw (Mandible) */}
            <g filter="url(#jawShadow)">
              {/* Lower gum tissue - U-shaped arch - wider */}
              <path 
                d="M50 260 
                   Q50 400 330 410 
                   Q610 400 610 260 
                   Q610 225 585 225
                   Q560 330 330 340
                   Q100 330 75 225
                   Q50 225 50 260Z"
                fill="url(#gumGradientLower)"
              />
              {/* Gum ridge detail */}
              <path 
                d="M75 250 
                   Q75 370 330 380 
                   Q585 370 585 250"
                fill="none"
                stroke="#C07070"
                strokeWidth="2"
                opacity="0.4"
              />
              {/* Gum highlight */}
              <path 
                d="M120 295 
                   Q120 355 330 365 
                   Q540 355 540 295"
                fill="none"
                stroke="#FFD5D5"
                strokeWidth="3"
                opacity="0.5"
                strokeLinecap="round"
              />
            </g>

            {/* Lower teeth positioned along the arch */}
            <g className="lower-teeth">
              {/* Right side (48-41) - зуб 48 только для взрослых */}
              {dentitionType === 'adult' && (
                <foreignObject x="60" y="230" width="56" height="85">
                  <div className="flex justify-center">
                    <Tooth number={48} type="molar" isUpper={false} status={getStatus(48)} 
                      isSelected={selectedTooth === 48} onClick={() => setSelectedTooth(selectedTooth === 48 ? null : 48)} delay={560} />
                  </div>
                </foreignObject>
              )}
              <foreignObject x="105" y="250" width="56" height="85">
                <div className="flex justify-center">
                  <Tooth number={47} type="molar" isUpper={false} status={getStatus(47)} 
                    isSelected={selectedTooth === 47} onClick={() => setSelectedTooth(selectedTooth === 47 ? null : 47)} delay={595} />
                </div>
              </foreignObject>
              <foreignObject x="148" y="268" width="56" height="80">
                <div className="flex justify-center">
                  <Tooth number={46} type="molar" isUpper={false} status={getStatus(46)} 
                    isSelected={selectedTooth === 46} onClick={() => setSelectedTooth(selectedTooth === 46 ? null : 46)} delay={630} />
                </div>
              </foreignObject>
              <foreignObject x="188" y="282" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={45} type="premolar" isUpper={false} status={getStatus(45)} 
                    isSelected={selectedTooth === 45} onClick={() => setSelectedTooth(selectedTooth === 45 ? null : 45)} delay={665} />
                </div>
              </foreignObject>
              <foreignObject x="222" y="290" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={44} type="premolar" isUpper={false} status={getStatus(44)} 
                    isSelected={selectedTooth === 44} onClick={() => setSelectedTooth(selectedTooth === 44 ? null : 44)} delay={700} />
                </div>
              </foreignObject>
              <foreignObject x="255" y="296" width="40" height="78">
                <div className="flex justify-center">
                  <Tooth number={43} type="canine" isUpper={false} status={getStatus(43)} 
                    isSelected={selectedTooth === 43} onClick={() => setSelectedTooth(selectedTooth === 43 ? null : 43)} delay={735} />
                </div>
              </foreignObject>
              <foreignObject x="285" y="302" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={42} type="incisor" isUpper={false} status={getStatus(42)} 
                    isSelected={selectedTooth === 42} onClick={() => setSelectedTooth(selectedTooth === 42 ? null : 42)} delay={770} />
                </div>
              </foreignObject>
              <foreignObject x="310" y="306" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={41} type="incisor" isUpper={false} status={getStatus(41)} 
                    isSelected={selectedTooth === 41} onClick={() => setSelectedTooth(selectedTooth === 41 ? null : 41)} delay={805} />
                </div>
              </foreignObject>

              {/* Left side (31-38) */}
              <foreignObject x="335" y="306" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={31} type="incisor" isUpper={false} status={getStatus(31)} 
                    isSelected={selectedTooth === 31} onClick={() => setSelectedTooth(selectedTooth === 31 ? null : 31)} delay={840} />
                </div>
              </foreignObject>
              <foreignObject x="360" y="302" width="34" height="70">
                <div className="flex justify-center">
                  <Tooth number={32} type="incisor" isUpper={false} status={getStatus(32)} 
                    isSelected={selectedTooth === 32} onClick={() => setSelectedTooth(selectedTooth === 32 ? null : 32)} delay={875} />
                </div>
              </foreignObject>
              <foreignObject x="385" y="296" width="40" height="78">
                <div className="flex justify-center">
                  <Tooth number={33} type="canine" isUpper={false} status={getStatus(33)} 
                    isSelected={selectedTooth === 33} onClick={() => setSelectedTooth(selectedTooth === 33 ? null : 33)} delay={910} />
                </div>
              </foreignObject>
              <foreignObject x="415" y="290" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={34} type="premolar" isUpper={false} status={getStatus(34)} 
                    isSelected={selectedTooth === 34} onClick={() => setSelectedTooth(selectedTooth === 34 ? null : 34)} delay={945} />
                </div>
              </foreignObject>
              <foreignObject x="450" y="282" width="46" height="75">
                <div className="flex justify-center">
                  <Tooth number={35} type="premolar" isUpper={false} status={getStatus(35)} 
                    isSelected={selectedTooth === 35} onClick={() => setSelectedTooth(selectedTooth === 35 ? null : 35)} delay={980} />
                </div>
              </foreignObject>
              <foreignObject x="485" y="268" width="56" height="80">
                <div className="flex justify-center">
                  <Tooth number={36} type="molar" isUpper={false} status={getStatus(36)} 
                    isSelected={selectedTooth === 36} onClick={() => setSelectedTooth(selectedTooth === 36 ? null : 36)} delay={1015} />
                </div>
              </foreignObject>
              <foreignObject x="528" y="250" width="56" height="85">
                <div className="flex justify-center">
                  <Tooth number={37} type="molar" isUpper={false} status={getStatus(37)} 
                    isSelected={selectedTooth === 37} onClick={() => setSelectedTooth(selectedTooth === 37 ? null : 37)} delay={1050} />
                </div>
              </foreignObject>
              {dentitionType === 'adult' && (
                <foreignObject x="570" y="230" width="56" height="85">
                  <div className="flex justify-center">
                    <Tooth number={38} type="molar" isUpper={false} status={getStatus(38)} 
                      isSelected={selectedTooth === 38} onClick={() => setSelectedTooth(selectedTooth === 38 ? null : 38)} delay={1085} />
                  </div>
                </foreignObject>
              )}
            </g>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2 border-t border-border/30">
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, { label, baseColor }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border border-black/10" style={{ backgroundColor: baseColor }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Selected tooth */}
        {selectedTooth && (
          <div className="mt-4 animate-fade-in">
            <SmartToothDetailCard 
              tooth={getToothData(selectedTooth)} 
              patientId={effectivePatientId!}
              isChild={false} 
              readOnly={true}
              onClose={() => setSelectedTooth(null)} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
