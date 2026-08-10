import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Baby, User, Blend, Info } from "lucide-react";
import { RealisticTooth, ToothStatus, STATUS_CONFIG } from "./RealisticTooth";
import { ToothDetailCard } from "./ToothDetailCard";
import { differenceInYears } from "date-fns";

type FormulaType = 'child' | 'adult' | 'mixed';

const isToothStatus = (value: unknown): value is ToothStatus =>
  typeof value === 'string' && value in STATUS_CONFIG;

// Tooth type mapping for adult teeth
const getToothType = (num: number): 'molar' | 'premolar' | 'canine' | 'incisor' => {
  const lastDigit = num % 10;
  if (lastDigit >= 6 && lastDigit <= 8) return 'molar';
  if (lastDigit >= 4 && lastDigit <= 5) return 'premolar';
  if (lastDigit === 3) return 'canine';
  return 'incisor';
};

// Adult teeth arrays (FDI notation)
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];

interface RealisticDentalChartProps {
  patientId?: string;
  birthDate?: string | null;
  readOnly?: boolean;
}

export function RealisticDentalChart({ patientId, birthDate, readOnly = true }: RealisticDentalChartProps) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  const patientAge = useMemo(() => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  }, [birthDate]);

  const defaultFormula: FormulaType = useMemo(() => {
    if (patientAge === null) return 'adult';
    if (patientAge < 6) return 'child';
    if (patientAge < 12) return 'mixed';
    return 'adult';
  }, [patientAge]);

  const [formulaType, setFormulaType] = useState<FormulaType>(defaultFormula);
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'planning' | 'history'>('planning');

  // Fetch teeth status
  const { data: teethData, isLoading } = useQuery({
    queryKey: ['patient-teeth-realistic', effectivePatientId, formulaType],
    queryFn: async () => {
      if (!effectivePatientId) return [];
      
      const { data, error } = await supabase
        .from('patient_teeth_status')
        .select(`
          *,
          doctors:doctor_id (
            user_id,
            profiles:user_id (full_name)
          )
        `)
        .eq('patient_id', effectivePatientId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectivePatientId,
  });

  const teethMap = useMemo(() => {
    type ToothRow = NonNullable<typeof teethData>[number];
    type ToothWithDoctor = ToothRow & { doctor_name?: string | null };
    const map = new Map<number, ToothWithDoctor>();
    teethData?.forEach(tooth => {
      map.set(tooth.tooth_number, {
        ...tooth,
        doctor_name: tooth.doctors?.profiles?.full_name
      });
    });
    return map;
  }, [teethData]);

  const getToothStatus = (number: number): ToothStatus => {
    const status = teethMap.get(number)?.status;
    return isToothStatus(status) ? status : 'healthy';
  };

  const getToothData = (number: number) => {
    const data = teethMap.get(number);
    return {
      tooth_number: number,
      status: isToothStatus(data?.status) ? data.status : 'healthy',
      notes: data?.notes,
      images: data?.images,
      materials: data?.materials,
      recommendations: data?.recommendations,
      doctor_name: data?.doctor_name,
      updated_at: data?.updated_at,
    };
  };

  const handleToothClick = (number: number) => {
    setSelectedTooth(selectedTooth === number ? null : number);
  };

  const problemCount = useMemo(() => {
    let count = 0;
    teethData?.forEach(tooth => {
      if (!['healthy', 'filling', 'crown', 'implant'].includes(tooth.status)) {
        count++;
      }
    });
    return count;
  }, [teethData]);

  const renderTeethRow = (teeth: number[], isUpper: boolean, startDelay: number = 0) => (
    <div className="flex items-end justify-center gap-0.5">
      {teeth.map((num, idx) => (
        <RealisticTooth
          key={num}
          number={num}
          status={getToothStatus(num)}
          type={getToothType(num)}
          isUpper={isUpper}
          isSelected={selectedTooth === num}
          onClick={() => handleToothClick(num)}
          animationDelay={startDelay + idx * 40}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-border/30 shadow-card">
        <CardContent className="p-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-card overflow-hidden bg-card">
      {/* Header */}
      <CardHeader className="border-b border-border/30 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl font-semibold">Chart</CardTitle>
            {problemCount > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-500/10">
                {problemCount} issues
              </Badge>
            )}
          </div>

          {/* View mode tabs */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'planning' | 'history')}>
            <TabsList className="bg-muted/50 h-9">
              <TabsTrigger value="planning" className="text-sm px-4">Planning</TabsTrigger>
              <TabsTrigger value="history" className="text-sm px-4">History</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Formula type switcher */}
        <div className="flex justify-center">
          <div className="flex gap-1 p-1 bg-muted/30 rounded-xl">
            <Button
              size="sm"
              variant={formulaType === 'child' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('child')}
              className="gap-1.5 rounded-lg h-8"
            >
              <Baby className="h-3.5 w-3.5" />
              <span className="text-xs">Child</span>
            </Button>
            <Button
              size="sm"
              variant={formulaType === 'adult' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('adult')}
              className="gap-1.5 rounded-lg h-8"
            >
              <User className="h-3.5 w-3.5" />
              <span className="text-xs">Adult</span>
            </Button>
            <Button
              size="sm"
              variant={formulaType === 'mixed' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('mixed')}
              className="gap-1.5 rounded-lg h-8"
            >
              <Blend className="h-3.5 w-3.5" />
              <span className="text-xs">Mixed</span>
            </Button>
          </div>
        </div>

        {/* Dental chart */}
        <div className="relative py-8 px-4">
          {/* Upper jaw */}
          <div className="flex justify-center gap-6 mb-2">
            {renderTeethRow(ADULT_UPPER_RIGHT, true, 0)}
            <div className="w-4" />
            {renderTeethRow(ADULT_UPPER_LEFT, true, 320)}
          </div>

          {/* Jaw separator */}
          <div className="relative my-10">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-card text-xs text-muted-foreground font-medium">
              32 teeth
            </div>
          </div>

          {/* Lower jaw */}
          <div className="flex justify-center gap-6 mt-2">
            {renderTeethRow(ADULT_LOWER_RIGHT.slice().reverse(), false, 640)}
            <div className="w-4" />
            {renderTeethRow(ADULT_LOWER_LEFT, false, 960)}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-border/30">
          {[
            { status: 'healthy', label: 'Healthy' },
            { status: 'caries', label: 'Caries' },
            { status: 'filling', label: 'Filling' },
            { status: 'crown', label: 'Crown' },
            { status: 'implant', label: 'Implant' },
            { status: 'removed', label: 'Removed' },
          ].map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div 
                className="w-3 h-3 rounded-sm border"
                style={{ 
                  backgroundColor: STATUS_CONFIG[status as ToothStatus].fill,
                  borderColor: STATUS_CONFIG[status as ToothStatus].stroke 
                }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>

        {/* Selected tooth detail */}
        {selectedTooth !== null && (
          <div className="mt-6 animate-fade-in">
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
