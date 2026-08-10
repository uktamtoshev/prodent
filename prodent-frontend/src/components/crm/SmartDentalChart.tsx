import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { SmartToothDetailCard } from "@/components/patient/dental/SmartToothDetailCard";
import { useLanguage } from "@/contexts/LanguageContext";
import { User, Baby, Blend, Save, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartDentalChartProps {
  patientId: string;
  birthDate?: string | null;
  doctorId?: string;
  clinicId?: string;
  readOnly?: boolean;
}

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

// Tooth arrays
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const YOUNG_UPPER_RIGHT = [17, 16, 15, 14, 13, 12, 11];
const YOUNG_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27];
const YOUNG_LOWER_RIGHT = [47, 46, 45, 44, 43, 42, 41];
const YOUNG_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37];

const CHILD_UPPER_RIGHT = [55, 54, 53, 52, 51];
const CHILD_UPPER_LEFT = [61, 62, 63, 64, 65];
const CHILD_LOWER_RIGHT = [85, 84, 83, 82, 81];
const CHILD_LOWER_LEFT = [71, 72, 73, 74, 75];

type DentitionType = 'child' | 'young' | 'adult';
type ViewMode = 'chart' | 'smart';

interface ToothMapEntry {
  tooth_number: number;
  status?: string | null;
  notes?: string | null;
  diagnosis?: string | null;
  doctor_name?: string | null;
  updated_at?: string | null;
}

const calculateAge = (birthDate: string | null | undefined): number => {
  if (!birthDate) return 25;
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

export function SmartDentalChart({
  patientId,
  birthDate,
  doctorId,
  clinicId,
  readOnly = false,
}: SmartDentalChartProps) {
  const { t } = useLanguage();
  /**
   * Tooth states.
   *
   * Colours used to be raw hex applied through `style={{ borderColor, color }}`
   * on tints built for a dark surface. On the white card the FDI number measured
   * 1.79-2.37:1 — and `removed` also carried `opacity-40`, pushing it below
   * 1.3:1. The number is what identifies the tooth, so "13 instead of 23" is a
   * treatment error, not a cosmetic one.
   *
   * Now `--tooth-*` token pairs (>= 4.5:1 in both themes, asserted in
   * design-tokens-contrast.contract.test.ts). Hues follow two families so the
   * colour itself carries meaning: CONDITION (healthy, watch, caries, perio,
   * endo) and RESTORATION (filling, crown, implant, removed).
   *
   * `code` is the short Latin mark used on paper odontograms. It makes the state
   * readable without colour (WCAG 1.4.1), reads identically in all six
   * languages, and — unlike the tooltip — is visible on a tablet at the chair,
   * where hover does not exist.
   */
  const TOOTH_STATUS: Record<ToothStatus, { label: string; code: string; tile: string }> = useMemo(() => ({
    healthy: { label: t('crmDentalChart.statusHealthy'), code: "", tile: "bg-tooth-healthy-bg border-tooth-healthy text-tooth-healthy" },
    watch: { label: t('crmDentalChart.statusWatch'), code: "W", tile: "bg-tooth-watch-bg border-tooth-watch text-tooth-watch" },
    caries: { label: t('crmDentalChart.statusCariesShort'), code: "C", tile: "bg-tooth-caries-bg border-tooth-caries text-tooth-caries" },
    periodontitis: { label: t('crmDentalChart.statusPeriodontitis'), code: "P", tile: "bg-tooth-perio-bg border-tooth-perio text-tooth-perio" },
    endo: { label: t('crmDentalChart.statusEndo'), code: "E", tile: "bg-tooth-endo-bg border-tooth-endo text-tooth-endo" },
    filling: { label: t('crmDentalChart.statusFillingShort'), code: "F", tile: "bg-tooth-filling-bg border-tooth-filling text-tooth-filling" },
    crown: { label: t('crmDentalChart.statusCrownShort'), code: "Cr", tile: "bg-tooth-crown-bg border-tooth-crown text-tooth-crown" },
    implant: { label: t('crmDentalChart.statusImplantShort'), code: "Im", tile: "bg-tooth-implant-bg border-tooth-implant text-tooth-implant" },
    removed: { label: t('crmDentalChart.statusRemoved'), code: "X", tile: "bg-tooth-removed-bg border-tooth-removed text-tooth-removed line-through" },
  }), [t]);
  const { currentClinic } = useClinic();
  const effectiveClinicId = clinicId || currentClinic?.id;
  const queryClient = useQueryClient();
  
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [editingTooth, setEditingTooth] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState<ToothStatus>("healthy");
  const [editDiagnosis, setEditDiagnosis] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [viewMode, setViewMode] = useState<'chart' | 'smart'>('chart');

  // Age and dentition type
  const age = useMemo(() => calculateAge(birthDate), [birthDate]);
  const dentitionType = useMemo(() => getDentitionType(age), [age]);
  const isChild = dentitionType === 'child';

  // Get teeth arrays based on age
  const teethArrays = useMemo(() => {
    if (dentitionType === 'child') {
      return {
        upperRight: CHILD_UPPER_RIGHT,
        upperLeft: CHILD_UPPER_LEFT,
        lowerRight: CHILD_LOWER_RIGHT,
        lowerLeft: CHILD_LOWER_LEFT,
        totalTeeth: 20,
        label: t('crmDentalChart.milkTeethLabel')
      };
    }
    if (dentitionType === 'young') {
      return {
        upperRight: YOUNG_UPPER_RIGHT,
        upperLeft: YOUNG_UPPER_LEFT,
        lowerRight: YOUNG_LOWER_RIGHT,
        lowerLeft: YOUNG_LOWER_LEFT,
        totalTeeth: 28,
        label: t('crmDentalChart.teeth28')
      };
    }
    return {
      upperRight: ADULT_UPPER_RIGHT,
      upperLeft: ADULT_UPPER_LEFT,
      lowerRight: ADULT_LOWER_RIGHT,
      lowerLeft: ADULT_LOWER_LEFT,
      totalTeeth: 32,
      label: t('crmDentalChart.teeth32')
    };
  }, [dentitionType, t]);

  // Fetch teeth data
  const { data: teethData } = useQuery({
    queryKey: ['smart-dental-chart', patientId, effectiveClinicId],
    queryFn: async () => {
      if (!patientId) return [];
      const { data } = await supabase
        .from('patient_teeth_status')
        .select('*, doctors:doctor_id(user_id, profiles:user_id(full_name))')
        .eq('patient_id', patientId);
      return data || [];
    },
    enabled: !!patientId,
  });

  // Also fetch dental_chart data for legacy support
  const { data: legacyData } = useQuery({
    queryKey: ['dental-chart-legacy', patientId, effectiveClinicId],
    queryFn: async () => {
      if (!patientId || !effectiveClinicId) return [];
      const { data } = await supabase
        .from('dental_chart')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', effectiveClinicId);
      return data || [];
    },
    enabled: !!patientId && !!effectiveClinicId,
  });

  // Merge teeth data
  const teethMap = useMemo(() => {
    const map = new Map<number, ToothMapEntry>();
    
    // First, add patient_teeth_status data
    teethData?.forEach(t => map.set(t.tooth_number, {
      ...t,
      doctor_name: t.doctors?.profiles?.full_name
    }));
    
    // Then, overlay dental_chart data (clinic-specific)
    legacyData?.forEach(t => {
      const existing = map.get(t.tooth_number);
      map.set(t.tooth_number, {
        ...existing,
        ...t,
        status: t.status || existing?.status || 'healthy',
      });
    });
    
    return map;
  }, [teethData, legacyData]);

  const getToothData = (n: number) => {
    const data = teethMap.get(n);
    return {
      tooth_number: n,
      status: (data?.status as ToothStatus) || 'healthy',
      notes: data?.notes,
      diagnosis: data?.diagnosis,
      doctor_name: data?.doctor_name,
      updated_at: data?.updated_at,
    };
  };

  const getToothStatus = (n: number): ToothStatus => {
    return teethMap.get(n)?.status || 'healthy';
  };

  // Count problems
  const problemCount = useMemo(() => {
    let count = 0;
    teethMap.forEach(t => {
      if (!['healthy', 'filling', 'crown', 'implant'].includes(t.status)) {
        count++;
      }
    });
    return count;
  }, [teethMap]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ toothNumber, status, diagnosis, notes }: { 
      toothNumber: number; 
      status: ToothStatus; 
      diagnosis: string; 
      notes: string;
    }) => {
      if (!effectiveClinicId) throw new Error("Clinic ID not found");
      
      const existing = legacyData?.find(d => d.tooth_number === toothNumber);
      const oldStatus = existing?.status || 'healthy';

      if (existing) {
        const { error } = await supabase
          .from('dental_chart')
          .update({ status, diagnosis, notes })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dental_chart')
          .insert({ 
            patient_id: patientId, 
            tooth_number: toothNumber, 
            status, 
            diagnosis, 
            notes,
            clinic_id: effectiveClinicId
          });
        if (error) throw error;
      }

      // Also create history entry if status changed
      if (oldStatus !== status) {
        await supabase.from('tooth_history').insert({
          patient_id: patientId,
          tooth_number: toothNumber,
          status_before: oldStatus,
          status_after: status,
          notes: diagnosis || notes,
          doctor_id: doctorId,
          clinic_id: effectiveClinicId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-dental-chart', patientId] });
      queryClient.invalidateQueries({ queryKey: ['dental-chart-legacy', patientId] });
      queryClient.invalidateQueries({ queryKey: ['tooth-history', patientId] });
      toast.success(t('crmDentalChart.toothSaved'));
      setEditingTooth(null);
    },
    onError: () => {
      toast.error(t('crmDentalChart.toothSaveError'));
    },
  });

  const handleToothClick = (toothNumber: number) => {
    if (viewMode === 'smart') {
      setSelectedTooth(selectedTooth === toothNumber ? null : toothNumber);
    } else {
      const data = getToothData(toothNumber);
      setEditingTooth(toothNumber);
      setEditStatus(data.status);
      setEditDiagnosis(data.diagnosis || "");
      setEditNotes(data.notes || "");
    }
  };

  const handleSave = () => {
    if (editingTooth) {
      saveMutation.mutate({
        toothNumber: editingTooth,
        status: editStatus,
        diagnosis: editDiagnosis,
        notes: editNotes,
      });
    }
  };

  const renderTooth = (toothNumber: number) => {
    const status = getToothStatus(toothNumber);
    const statusInfo = TOOTH_STATUS[status];
    const isProblematic = ['caries', 'endo', 'periodontitis', 'watch'].includes(status);
    const isSelected = selectedTooth === toothNumber;
    const isHealthy = status === 'healthy';

    return (
      <TooltipProvider key={toothNumber}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleToothClick(toothNumber)}
              aria-pressed={isSelected}
              aria-label={`${t('crmDentalChart.tooltipNumber')}${toothNumber}, ${statusInfo.label}`}
              className={cn(
                "relative flex h-10 w-10 cursor-pointer flex-col items-center justify-center gap-0.5",
                "rounded-lg border-2 text-sm font-semibold tabular-nums transition-transform",
                "hover:-translate-y-0.5 hover:scale-105",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                // Tile stays 40px so 16 teeth still fit one row, but the hit area
                // is padded out to 44px for a gloved finger on a tablet.
                "after:absolute after:-inset-0.5 after:content-['']",
                statusInfo.tile,
                isSelected && "scale-105 ring-2 ring-primary ring-offset-2"
              )}
            >
              <span>{toothNumber}</span>
              {statusInfo.code ? (
                <span aria-hidden="true" className="text-xs font-bold leading-none no-underline">
                  {statusInfo.code}
                </span>
              ) : null}
              {isProblematic && (
                <span aria-hidden="true" className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-status-danger" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-card/95 backdrop-blur border-border/50">
            <div className="text-sm">
              <div className="font-semibold">{t('crmDentalChart.tooltipNumber')}{toothNumber}</div>
              <div className="text-muted-foreground">{statusInfo.label}</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <>
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/50 px-card-x py-card-y">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {dentitionType === 'child' ? (
                <Baby className="h-5 w-5 text-primary" />
              ) : dentitionType === 'young' ? (
                <Blend className="h-5 w-5 text-primary" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
              <div>
                <CardTitle className="text-foreground text-base">{t('crmDentalChart.formulaTitle')}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {age} {t('crmDentalChart.yearsLabel')} • {teethArrays.totalTeeth} {teethArrays.totalTeeth === 20 ? t('crmDentalChart.teethGenitiveMany') : teethArrays.totalTeeth === 28 ? t('crmDentalChart.teethGenitiveMany') : t('crmDentalChart.teethGenitive')}
                </p>
              </div>
              {problemCount > 0 && (
                <Badge variant="outline" className="border-status-warning/50 text-status-warning bg-status-warning-bg">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {problemCount} {t('crmDentalChart.problemsCount')}
                </Badge>
              )}
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList className="h-8 bg-muted/50">
                <TabsTrigger value="chart" className="text-xs h-7 px-3">{t('crmDentalChart.modeSimple')}</TabsTrigger>
                <TabsTrigger value="smart" className="text-xs h-7 px-3">{t('crmDentalChart.modeSmart')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Upper Jaw */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs text-center font-medium">{t('crmDentalChart.upperJaw')}</div>
            <div className="flex justify-center gap-1.5">
              <div className="flex gap-1">{teethArrays.upperRight.map(renderTooth)}</div>
              <div className="w-3 md:w-4" />
              <div className="flex gap-1">{teethArrays.upperLeft.map(renderTooth)}</div>
            </div>
          </div>

          {/* Lower Jaw */}
          <div className="space-y-2">
            <div className="flex justify-center gap-1.5">
              <div className="flex gap-1">{teethArrays.lowerRight.map(renderTooth)}</div>
              <div className="w-3 md:w-4" />
              <div className="flex gap-1">{teethArrays.lowerLeft.map(renderTooth)}</div>
            </div>
            <div className="text-muted-foreground text-xs text-center font-medium">{t('crmDentalChart.lowerJaw')}</div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center pt-4 border-t border-border/50">
            {/* All nine states, not the first six: a legend that omits three of
                the states present on the chart teaches a partial language. */}
            {Object.entries(TOOTH_STATUS).map(([key, { label, code, tile }]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded border-2 text-xs font-bold no-underline",
                    tile,
                  )}
                >
                  {code}
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Smart Detail Card */}
          {viewMode === 'smart' && selectedTooth && (
            <div className="mt-4 animate-fade-in">
              <SmartToothDetailCard
                tooth={getToothData(selectedTooth)}
                patientId={patientId}
                isChild={isChild}
                readOnly={readOnly}
                doctorId={doctorId}
                onClose={() => setSelectedTooth(null)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog (for simple mode) */}
      <Dialog open={editingTooth !== null && viewMode === 'chart'} onOpenChange={() => setEditingTooth(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {/* Same token pair as the tile, so the dialog and the chart agree
                  about what this tooth's state looks like. `text-white` on a raw
                  hex background was unreadable for the lighter states. */}
              <div
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg border-2 text-sm font-bold tabular-nums no-underline",
                  TOOTH_STATUS[editStatus]?.tile,
                )}
              >
                {editingTooth}
              </div>
              {t('crmDentalChart.toothLabel')}{editingTooth}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label id="smart-tooth-status-label" className="text-foreground">{t('crmDentalChart.statusLabel')}</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ToothStatus)}>
                <SelectTrigger aria-labelledby="smart-tooth-status-label" className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(TOOTH_STATUS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="smart-tooth-diagnosis" className="text-foreground">{t('crmDentalChart.diagnosisLabel')}</Label>
              <Textarea
                id="smart-tooth-diagnosis"
                value={editDiagnosis}
                onChange={(e) => setEditDiagnosis(e.target.value)}
                placeholder={t('crmDentalChart.diagnosisPh')}
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smart-tooth-notes" className="text-foreground">{t('crmDentalChart.notesLabel')}</Label>
              <Textarea
                id="smart-tooth-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t('crmDentalChart.notesPh')}
                className="bg-background border-border"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingTooth(null)}>
                <X className="h-4 w-4 mr-1" />
                {t('crmDentalChart.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? t('crmDentalChart.saving') : t('crmDentalChart.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
