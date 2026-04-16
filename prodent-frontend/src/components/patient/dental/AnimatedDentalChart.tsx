import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Baby, User, Blend, Activity } from "lucide-react";
import { ToothComponent, ToothStatus, CHILD_STATUS_CONFIG, ADULT_STATUS_CONFIG } from "./ToothComponent";
import { ToothDetailCard } from "./ToothDetailCard";
import { differenceInYears } from "date-fns";

type FormulaType = 'child' | 'adult' | 'mixed';

// Child teeth numbers (FDI notation)
const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];
const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];

// Adult teeth numbers (FDI notation)
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

interface AnimatedDentalChartProps {
  patientId?: string;
  birthDate?: string | null;
  readOnly?: boolean;
}

export function AnimatedDentalChart({ patientId, birthDate, readOnly = true }: AnimatedDentalChartProps) {
  const { user } = useAuth();
  const effectivePatientId = patientId || user?.id;

  // Calculate age and determine default formula
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

  // Fetch teeth status from database
  const { data: teethData, isLoading } = useQuery({
    queryKey: ['patient-teeth', effectivePatientId, formulaType],
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
        .eq('patient_id', effectivePatientId)
        .in('formula_type', formulaType === 'mixed' ? ['child', 'adult'] : [formulaType]);

      if (error) throw error;
      return data || [];
    },
    enabled: !!effectivePatientId,
  });

  // Build teeth map for quick lookup
  const teethMap = useMemo(() => {
    const map = new Map<number, any>();
    teethData?.forEach(tooth => {
      map.set(tooth.tooth_number, {
        ...tooth,
        doctor_name: tooth.doctors?.profiles?.full_name
      });
    });
    return map;
  }, [teethData]);

  const getToothStatus = (number: number): ToothStatus => {
    return teethMap.get(number)?.status || 'healthy';
  };

  const getToothData = (number: number) => {
    const data = teethMap.get(number);
    return {
      tooth_number: number,
      status: data?.status || 'healthy',
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

  // Determine which teeth to show
  const showChildTeeth = formulaType === 'child' || formulaType === 'mixed';
  const showAdultTeeth = formulaType === 'adult' || formulaType === 'mixed';

  const renderTeethRow = (teeth: number[], isChild: boolean, startDelay: number = 0) => (
    <div className="flex justify-center gap-1 md:gap-1.5">
      {teeth.map((num, idx) => (
        <ToothComponent
          key={num}
          number={num}
          status={getToothStatus(num)}
          isChild={isChild}
          isSelected={selectedTooth === num}
          onClick={() => handleToothClick(num)}
          animationDelay={startDelay + idx * 30}
        />
      ))}
    </div>
  );

  // Count problem teeth
  const problemCount = useMemo(() => {
    let count = 0;
    teethData?.forEach(tooth => {
      if (!['healthy', 'filling', 'crown', 'implant'].includes(tooth.status)) {
        count++;
      }
    });
    return count;
  }, [teethData]);

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="bg-gradient-subtle pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-tashkent-sky">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Зубная формула</CardTitle>
              {patientAge !== null && (
                <p className="text-sm text-muted-foreground">
                  Возраст: {patientAge} лет
                  {problemCount > 0 && (
                    <Badge variant="outline" className="ml-2 border-amber-500/50 text-amber-600 bg-amber-500/10">
                      {problemCount} проблем
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Formula type switcher */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
            <Button
              size="sm"
              variant={formulaType === 'child' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('child')}
              className="gap-1.5 rounded-lg"
            >
              <Baby className="h-4 w-4" />
              <span className="hidden sm:inline">Детская</span>
            </Button>
            <Button
              size="sm"
              variant={formulaType === 'adult' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('adult')}
              className="gap-1.5 rounded-lg"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Взрослая</span>
            </Button>
            <Button
              size="sm"
              variant={formulaType === 'mixed' ? 'default' : 'ghost'}
              onClick={() => setFormulaType('mixed')}
              className="gap-1.5 rounded-lg"
            >
              <Blend className="h-4 w-4" />
              <span className="hidden sm:inline">Смешанная</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Dental chart visualization */}
        <div className="relative p-4 md:p-6 bg-gradient-to-b from-muted/30 to-transparent rounded-2xl">
          {/* Upper jaw */}
          <div className="space-y-2">
            {showAdultTeeth && (
              <div className="flex justify-center gap-2 md:gap-4">
                {renderTeethRow(ADULT_UPPER_RIGHT, false, 0)}
                <div className="w-px bg-border/50" />
                {renderTeethRow(ADULT_UPPER_LEFT, false, 240)}
              </div>
            )}
            
            {showChildTeeth && (
              <div className="flex justify-center gap-2 md:gap-4 mt-2">
                {renderTeethRow(CHILD_UPPER_RIGHT, true, 480)}
                <div className="w-px bg-border/50" />
                {renderTeethRow(CHILD_UPPER_LEFT, true, 630)}
              </div>
            )}
          </div>

          {/* Jaw divider */}
          <div className="my-4 md:my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <span className="text-xs text-muted-foreground font-medium px-3 py-1 bg-muted/50 rounded-full">
              {formulaType === 'child' ? '20 зубов' : formulaType === 'adult' ? '32 зуба' : 'Смешанный прикус'}
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>

          {/* Lower jaw */}
          <div className="space-y-2">
            {showChildTeeth && (
              <div className="flex justify-center gap-2 md:gap-4 mb-2">
                {renderTeethRow(CHILD_LOWER_RIGHT, true, 780)}
                <div className="w-px bg-border/50" />
                {renderTeethRow(CHILD_LOWER_LEFT, true, 930)}
              </div>
            )}
            
            {showAdultTeeth && (
              <div className="flex justify-center gap-2 md:gap-4">
                {renderTeethRow(ADULT_LOWER_RIGHT, false, 1080)}
                <div className="w-px bg-border/50" />
                {renderTeethRow(ADULT_LOWER_LEFT, false, 1320)}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 justify-center">
          {formulaType === 'child' || formulaType === 'mixed' ? (
            Object.entries(CHILD_STATUS_CONFIG).slice(0, 6).map(([key, { color, label }]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))
          ) : (
            Object.entries(ADULT_STATUS_CONFIG).slice(0, 6).map(([key, { color, label }]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className={`w-3 h-3 rounded-full ${color}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))
          )}
        </div>

        {/* Selected tooth detail */}
        {selectedTooth !== null && (
          <div className="mt-4">
            <ToothDetailCard
              tooth={getToothData(selectedTooth)}
              isChild={formulaType === 'child' || (formulaType === 'mixed' && selectedTooth >= 51)}
              onClose={() => setSelectedTooth(null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
