import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Baby, User, Blend, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { SmartToothDetailCard } from "./SmartToothDetailCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const STATUS_CONFIG: Record<ToothStatus, { label: string; color: string; glowColor: string }> = {
  healthy: { label: 'Здоровый', color: '#FFFFFF', glowColor: 'transparent' },
  caries: { label: 'Кариес', color: '#FCD34D', glowColor: '#FCD34D' },
  filling: { label: 'Пломба', color: '#93C5FD', glowColor: '#3B82F6' },
  crown: { label: 'Коронка', color: '#FDE68A', glowColor: '#F59E0B' },
  implant: { label: 'Имплант', color: '#A1A1AA', glowColor: '#71717A' },
  removed: { label: 'Удалён', color: '#6B7280', glowColor: 'transparent' },
  watch: { label: 'Наблюдение', color: '#FDBA74', glowColor: '#F97316' },
  endo: { label: 'Эндодонтия', color: '#FCA5A5', glowColor: '#EF4444' },
  periodontitis: { label: 'Периодонтит', color: '#F87171', glowColor: '#DC2626' },
};

// 3D Realistic Tooth Component
const Realistic3DTooth = ({ 
  number, 
  type, 
  isUpper, 
  status,
  isSelected,
  onClick,
  scale = 1
}: { 
  number: number;
  type: 'molar' | 'premolar' | 'canine' | 'incisor';
  isUpper: boolean;
  status: ToothStatus;
  isSelected: boolean;
  onClick: () => void;
  scale?: number;
}) => {
  const config = STATUS_CONFIG[status];
  const isMissing = status === 'removed';
  const isProblematic = ['caries', 'endo', 'periodontitis', 'watch'].includes(status);
  const id = `tooth3d-${number}`;

  // Get tooth dimensions based on type
  const getDimensions = () => {
    switch (type) {
      case 'molar': return { width: 38 * scale, height: 45 * scale };
      case 'premolar': return { width: 28 * scale, height: 40 * scale };
      case 'canine': return { width: 24 * scale, height: 48 * scale };
      case 'incisor': return { width: 22 * scale, height: 38 * scale };
    }
  };

  const dims = getDimensions();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isMissing}
            className={cn(
              "relative flex flex-col items-center gap-0.5 transition-all duration-300",
              "hover:scale-110 hover:-translate-y-1",
              isSelected && "scale-115 -translate-y-2 z-20",
              isMissing && "opacity-20 cursor-not-allowed hover:scale-100 hover:translate-y-0"
            )}
            style={{ 
              filter: isSelected ? `drop-shadow(0 0 12px ${config.glowColor || 'hsl(var(--primary))'})` : 'none'
            }}
          >
            <svg 
              width={dims.width} 
              height={dims.height}
              viewBox="0 0 100 120"
              className="transition-transform duration-300"
            >
              <defs>
                {/* Main tooth gradient - porcelain effect */}
                <linearGradient id={`${id}-main`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="20%" stopColor="#F8F8FC" />
                  <stop offset="50%" stopColor={status === 'healthy' ? '#F0EEF5' : config.color} stopOpacity={status === 'healthy' ? 1 : 0.6} />
                  <stop offset="80%" stopColor="#E8E4F0" />
                  <stop offset="100%" stopColor="#D8D2E5" />
                </linearGradient>

                {/* Highlight gradient - top shine */}
                <linearGradient id={`${id}-shine`} x1="20%" y1="0%" x2="80%" y2="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </linearGradient>

                {/* Side shadow */}
                <linearGradient id={`${id}-shadow`} x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#000" stopOpacity="0.15" />
                  <stop offset="15%" stopColor="#000" stopOpacity="0" />
                  <stop offset="85%" stopColor="#000" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0.2" />
                </linearGradient>

                {/* Inner depth */}
                <radialGradient id={`${id}-depth`} cx="50%" cy="40%" r="45%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="70%" stopColor="transparent" />
                  <stop offset="100%" stopColor="#9090A0" stopOpacity="0.2" />
                </radialGradient>

                {/* Glow effect for selected/problem teeth */}
                <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="blur"/>
                  <feMerge>
                    <feMergeNode in="blur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>

                {/* Drop shadow */}
                <filter id={`${id}-drop`} x="-30%" y="-10%" width="160%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.2"/>
                </filter>
              </defs>

              {/* Tooth shape based on type */}
              {type === 'molar' && (
                <g filter={`url(#${id}-drop)`}>
                  {/* Tooth body */}
                  <path
                    d={isUpper 
                      ? "M15 100 C8 95 5 80 8 60 C10 40 18 20 30 12 C42 4 58 4 70 12 C82 20 90 40 92 60 C95 80 92 95 85 100 C78 108 70 110 50 110 C30 110 22 108 15 100 Z"
                      : "M15 20 C8 25 5 40 8 60 C10 80 18 100 30 108 C42 116 58 116 70 108 C82 100 90 80 92 60 C95 40 92 25 85 20 C78 12 70 10 50 10 C30 10 22 12 15 20 Z"
                    }
                    fill={`url(#${id}-main)`}
                    stroke={isSelected ? 'hsl(175, 82%, 38%)' : '#C0B8D0'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Occlusal surface / crown top */}
                  <ellipse 
                    cx="50" 
                    cy={isUpper ? 65 : 55} 
                    rx="30" 
                    ry="20"
                    fill={`url(#${id}-depth)`}
                  />
                  {/* Fissure pattern */}
                  <path
                    d={`M30 ${isUpper ? 60 : 50} Q40 ${isUpper ? 55 : 60} 50 ${isUpper ? 58 : 52} Q60 ${isUpper ? 55 : 60} 70 ${isUpper ? 60 : 50}`}
                    fill="none"
                    stroke="#A8A0B8"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                  <path
                    d={`M50 ${isUpper ? 58 : 52} L50 ${isUpper ? 72 : 66}`}
                    fill="none"
                    stroke="#A8A0B8"
                    strokeWidth="1"
                    opacity="0.5"
                  />
                  {/* Highlights */}
                  <path
                    d={isUpper 
                      ? "M25 70 C20 50 30 30 50 25 C55 25 60 28 65 32"
                      : "M25 50 C20 70 30 90 50 95 C55 95 60 92 65 88"
                    }
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    opacity="0.5"
                    strokeLinecap="round"
                  />
                  {/* Status indicator for filling */}
                  {status === 'filling' && (
                    <ellipse cx="50" cy={isUpper ? 65 : 55} rx="14" ry="10" fill="#94A3B8" opacity="0.8" stroke="#64748B" strokeWidth="1"/>
                  )}
                  {status === 'caries' && (
                    <ellipse cx="50" cy={isUpper ? 65 : 55} rx="12" ry="8" fill="#7C2D12" opacity="0.8"/>
                  )}
                  {status === 'crown' && (
                    <path
                      d={isUpper 
                        ? "M18 95 C12 90 10 75 12 55 C14 35 22 18 34 10"
                        : "M18 25 C12 30 10 45 12 65 C14 85 22 102 34 110"
                      }
                      fill="none"
                      stroke="#DAA520"
                      strokeWidth="3"
                      opacity="0.8"
                      strokeDasharray="6,3"
                    />
                  )}
                </g>
              )}

              {type === 'premolar' && (
                <g filter={`url(#${id}-drop)`}>
                  <path
                    d={isUpper 
                      ? "M20 100 C12 92 12 75 15 55 C18 35 28 18 40 10 C52 2 60 2 72 12 C84 22 88 42 88 60 C88 78 84 92 76 100 C68 108 56 110 48 110 C40 110 28 108 20 100 Z"
                      : "M20 20 C12 28 12 45 15 65 C18 85 28 102 40 110 C52 118 60 118 72 108 C84 98 88 78 88 60 C88 42 84 28 76 20 C68 12 56 10 48 10 C40 10 28 12 20 20 Z"
                    }
                    fill={`url(#${id}-main)`}
                    stroke={isSelected ? 'hsl(175, 82%, 38%)' : '#C0B8D0'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  <ellipse cx="50" cy={isUpper ? 60 : 60} rx="22" ry="15" fill={`url(#${id}-depth)`}/>
                  <path
                    d={`M35 ${isUpper ? 58 : 62} Q50 ${isUpper ? 50 : 70} 65 ${isUpper ? 58 : 62}`}
                    fill="none"
                    stroke="#A8A0B8"
                    strokeWidth="1.2"
                    opacity="0.5"
                  />
                  <path
                    d={isUpper ? "M30 60 C28 45 38 30 50 28" : "M30 60 C28 75 38 90 50 92"}
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    opacity="0.4"
                    strokeLinecap="round"
                  />
                  {status === 'filling' && (
                    <ellipse cx="50" cy={isUpper ? 60 : 60} rx="10" ry="7" fill="#94A3B8" opacity="0.8"/>
                  )}
                  {status === 'caries' && (
                    <ellipse cx="50" cy={isUpper ? 60 : 60} rx="8" ry="6" fill="#7C2D12" opacity="0.8"/>
                  )}
                </g>
              )}

              {type === 'canine' && (
                <g filter={`url(#${id}-drop)`}>
                  <path
                    d={isUpper 
                      ? "M25 105 C15 98 15 80 18 55 C21 30 32 12 50 5 C68 12 79 30 82 55 C85 80 85 98 75 105 C65 112 58 115 50 115 C42 115 35 112 25 105 Z"
                      : "M25 15 C15 22 15 40 18 65 C21 90 32 108 50 115 C68 108 79 90 82 65 C85 40 85 22 75 15 C65 8 58 5 50 5 C42 5 35 8 25 15 Z"
                    }
                    fill={`url(#${id}-main)`}
                    stroke={isSelected ? 'hsl(175, 82%, 38%)' : '#C0B8D0'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Cusp highlight */}
                  <ellipse 
                    cx="50" 
                    cy={isUpper ? 25 : 95}
                    rx="8" 
                    ry="5"
                    fill="white"
                    opacity="0.6"
                  />
                  <path
                    d={isUpper ? "M32 70 C30 50 40 25 50 15" : "M32 50 C30 70 40 95 50 105"}
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    opacity="0.4"
                    strokeLinecap="round"
                  />
                  {/* Mesial/distal ridges */}
                  <path
                    d={isUpper 
                      ? "M35 45 L50 18 L65 45"
                      : "M35 75 L50 102 L65 75"
                    }
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    opacity="0.25"
                  />
                </g>
              )}

              {type === 'incisor' && (
                <g filter={`url(#${id}-drop)`}>
                  <path
                    d={isUpper 
                      ? "M22 100 C14 92 14 75 18 55 C22 35 32 18 50 12 C68 18 78 35 82 55 C86 75 86 92 78 100 C70 108 60 110 50 110 C40 110 30 108 22 100 Z"
                      : "M22 20 C14 28 14 45 18 65 C22 85 32 102 50 108 C68 102 78 85 82 65 C86 45 86 28 78 20 C70 12 60 10 50 10 C40 10 30 12 22 20 Z"
                    }
                    fill={`url(#${id}-main)`}
                    stroke={isSelected ? 'hsl(175, 82%, 38%)' : '#C0B8D0'}
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  {/* Incisal edge */}
                  <line 
                    x1="32" y1={isUpper ? 100 : 20}
                    x2="68" y2={isUpper ? 100 : 20}
                    stroke="white"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <path
                    d={isUpper ? "M30 65 C28 50 38 30 50 25" : "M30 55 C28 70 38 90 50 95"}
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    opacity="0.4"
                    strokeLinecap="round"
                  />
                </g>
              )}
            </svg>

            {/* Tooth number badge */}
            <span className={cn(
              "flex items-center justify-center w-5 h-5 text-[9px] font-bold rounded-full transition-all duration-200",
              isSelected 
                ? "bg-primary text-primary-foreground shadow-md" 
                : "bg-muted/90 text-muted-foreground"
            )}>
              {number}
            </span>

            {/* Problem indicator */}
            {isProblematic && !isMissing && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 z-10">
                <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative rounded-full h-2.5 w-2.5 bg-red-500 border border-white" />
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-card/95 backdrop-blur-lg border-border/50 shadow-xl">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full border border-black/10" 
              style={{ backgroundColor: config.color }}
            />
            <div>
              <p className="font-semibold text-sm">Зуб {number}</p>
              <p className="text-xs text-muted-foreground">{config.label}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Tooth type helper
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

// Tooth arrays
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

export function Realistic3DDentalChart({ patientId, birthDate }: { patientId?: string; birthDate?: string | null }) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const age = useMemo(() => calculateAge(birthDate), [birthDate]);
  const dentitionType = useMemo(() => getDentitionType(age), [age]);
  const isChild = dentitionType === 'child';

  const teethArrays = useMemo(() => {
    if (dentitionType === 'child') {
      return {
        upperRight: CHILD_UPPER_RIGHT,
        upperLeft: CHILD_UPPER_LEFT,
        lowerLeft: CHILD_LOWER_LEFT,
        lowerRight: CHILD_LOWER_RIGHT,
        totalTeeth: 20,
      };
    }
    if (dentitionType === 'young') {
      return {
        upperRight: YOUNG_UPPER_RIGHT,
        upperLeft: YOUNG_UPPER_LEFT,
        lowerLeft: YOUNG_LOWER_LEFT,
        lowerRight: YOUNG_LOWER_RIGHT,
        totalTeeth: 28,
      };
    }
    return {
      upperRight: ADULT_UPPER_RIGHT,
      upperLeft: ADULT_UPPER_LEFT,
      lowerLeft: ADULT_LOWER_LEFT,
      lowerRight: ADULT_LOWER_RIGHT,
      totalTeeth: 32,
    };
  }, [dentitionType]);

  const { data: teethData, isLoading } = useQuery({
    queryKey: ['3d-teeth', effectivePatientId],
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

  if (isLoading) {
    return <Card className="border-border/30"><CardContent className="p-8"><Skeleton className="h-80 w-full rounded-2xl" /></CardContent></Card>;
  }

  return (
    <Card className="border-border/30 shadow-card bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {dentitionType === 'child' ? (
              <Baby className="h-5 w-5 text-pink-500" />
            ) : dentitionType === 'young' ? (
              <Blend className="h-5 w-5 text-blue-500" />
            ) : (
              <User className="h-5 w-5 text-primary" />
            )}
            <h2 className="text-lg font-semibold">Зубная карта пациента</h2>
          </div>
          <Badge variant="outline" className="border-primary/50 text-primary bg-primary/5 font-medium">
            {teethArrays.totalTeeth} зубов
          </Badge>
          {problemCount > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {problemCount} проблем
            </Badge>
          )}
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.max(0.7, z - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(z => Math.min(1.3, z + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setZoom(1)}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-6 space-y-4">
        {/* 3D Dental Chart Container */}
        <div 
          className="relative rounded-3xl overflow-hidden py-8 px-4"
          style={{
            background: 'radial-gradient(ellipse at center, #1a0a0a 0%, #0f0505 50%, #050202 100%)',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.8), 0 10px 40px rgba(0,0,0,0.3)',
          }}
        >
          {/* Mouth interior gradient overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(80,20,20,0.3) 0%, transparent 70%)'
            }}
          />

          <div 
            className="relative flex flex-col items-center gap-1 transition-transform duration-300"
            style={{ transform: `scale(${zoom})` }}
          >
            {/* Upper Gum Arc */}
            <svg 
              viewBox="0 0 700 120" 
              className="w-full max-w-3xl -mb-10"
              style={{ height: 90 * zoom }}
            >
              <defs>
                <linearGradient id="upperGum" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF9999" stopOpacity="0.9" />
                  <stop offset="40%" stopColor="#E87777" />
                  <stop offset="70%" stopColor="#CC5555" />
                  <stop offset="100%" stopColor="#AA4444" />
                </linearGradient>
                <filter id="gumShadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.4"/>
                </filter>
              </defs>
              <path 
                d="M20 120 Q20 20 350 10 Q680 20 680 120 Q650 80 350 70 Q50 80 20 120 Z"
                fill="url(#upperGum)"
                filter="url(#gumShadow)"
              />
              {/* Gum highlight */}
              <path 
                d="M80 90 Q80 50 350 42 Q620 50 620 90"
                fill="none"
                stroke="#FFBBBB"
                strokeWidth="3"
                opacity="0.5"
                strokeLinecap="round"
              />
            </svg>

            {/* Upper Teeth Row */}
            <div className="flex items-end justify-center gap-0.5 relative z-10 -mt-2">
              {teethArrays.upperRight.map((n) => (
                <Realistic3DTooth
                  key={n}
                  number={n}
                  type={getToothType(n, isChild)}
                  isUpper={true}
                  status={getStatus(n)}
                  isSelected={selectedTooth === n}
                  onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                  scale={zoom}
                />
              ))}
              <div className="w-3" />
              {teethArrays.upperLeft.map((n) => (
                <Realistic3DTooth
                  key={n}
                  number={n}
                  type={getToothType(n, isChild)}
                  isUpper={true}
                  status={getStatus(n)}
                  isSelected={selectedTooth === n}
                  onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                  scale={zoom}
                />
              ))}
            </div>

            {/* Center divider with tooth count */}
            <div className="flex items-center justify-center gap-4 py-3">
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-card/20 backdrop-blur-sm border border-white/10">
                <span className="text-xs font-medium text-white/80">FDI</span>
                <span className="text-sm font-bold text-primary">{teethArrays.totalTeeth}</span>
              </div>
              <div className="h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            </div>

            {/* Lower Teeth Row */}
            <div className="flex items-start justify-center gap-0.5 relative z-10 -mb-2">
              {teethArrays.lowerRight.map((n) => (
                <Realistic3DTooth
                  key={n}
                  number={n}
                  type={getToothType(n, isChild)}
                  isUpper={false}
                  status={getStatus(n)}
                  isSelected={selectedTooth === n}
                  onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                  scale={zoom}
                />
              ))}
              <div className="w-3" />
              {teethArrays.lowerLeft.map((n) => (
                <Realistic3DTooth
                  key={n}
                  number={n}
                  type={getToothType(n, isChild)}
                  isUpper={false}
                  status={getStatus(n)}
                  isSelected={selectedTooth === n}
                  onClick={() => setSelectedTooth(selectedTooth === n ? null : n)}
                  scale={zoom}
                />
              ))}
            </div>

            {/* Lower Gum Arc */}
            <svg 
              viewBox="0 0 700 120" 
              className="w-full max-w-3xl -mt-10"
              style={{ height: 90 * zoom }}
            >
              <defs>
                <linearGradient id="lowerGum" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#FF9999" stopOpacity="0.9" />
                  <stop offset="40%" stopColor="#E87777" />
                  <stop offset="70%" stopColor="#CC5555" />
                  <stop offset="100%" stopColor="#AA4444" />
                </linearGradient>
              </defs>
              <path 
                d="M20 0 Q20 100 350 110 Q680 100 680 0 Q650 40 350 50 Q50 40 20 0 Z"
                fill="url(#lowerGum)"
                filter="url(#gumShadow)"
              />
              {/* Gum highlight */}
              <path 
                d="M80 30 Q80 70 350 78 Q620 70 620 30"
                fill="none"
                stroke="#FFBBBB"
                strokeWidth="3"
                opacity="0.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-4 border-t border-border/30">
          {Object.entries(STATUS_CONFIG).slice(0, 6).map(([key, { label, color }]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div 
                className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-sm" 
                style={{ backgroundColor: color }} 
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Selected tooth details */}
        {selectedTooth && (
          <div className="mt-4 animate-fade-in">
            <SmartToothDetailCard 
              tooth={getToothData(selectedTooth)} 
              patientId={effectivePatientId!}
              isChild={isChild} 
              readOnly={true}
              onClose={() => setSelectedTooth(null)} 
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
