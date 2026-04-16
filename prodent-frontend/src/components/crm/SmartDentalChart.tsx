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
import { User, Baby, Blend, Save, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartDentalChartProps {
  patientId: string;
  birthDate?: string | null;
  doctorId?: string;
  readOnly?: boolean;
}

type ToothStatus = 'healthy' | 'caries' | 'filling' | 'crown' | 'implant' | 'removed' | 'watch' | 'endo' | 'periodontitis';

const TOOTH_STATUS: Record<ToothStatus, { label: string; color: string; bgColor: string }> = {
  healthy: { label: "Здоров", color: "hsl(var(--primary))", bgColor: "bg-primary/10" },
  caries: { label: "Кариес", color: "#F59E0B", bgColor: "bg-amber-500/10" },
  filling: { label: "Пломба", color: "#3B82F6", bgColor: "bg-blue-500/10" },
  crown: { label: "Коронка", color: "#EAB308", bgColor: "bg-yellow-500/10" },
  implant: { label: "Имплант", color: "#64748B", bgColor: "bg-slate-500/10" },
  removed: { label: "Удален", color: "#9CA3AF", bgColor: "bg-gray-500/10" },
  watch: { label: "Наблюдение", color: "#F97316", bgColor: "bg-orange-500/10" },
  endo: { label: "Эндодонтия", color: "#EF4444", bgColor: "bg-red-500/10" },
  periodontitis: { label: "Периодонтит", color: "#DC2626", bgColor: "bg-red-600/10" },
};

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

export function SmartDentalChart({ patientId, birthDate, doctorId, readOnly = false }: SmartDentalChartProps) {
  const { currentClinic } = useClinic();
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
        label: 'Молочные зубы'
      };
    }
    if (dentitionType === 'young') {
      return {
        upperRight: YOUNG_UPPER_RIGHT,
        upperLeft: YOUNG_UPPER_LEFT,
        lowerRight: YOUNG_LOWER_RIGHT,
        lowerLeft: YOUNG_LOWER_LEFT,
        totalTeeth: 28,
        label: '28 зубов'
      };
    }
    return {
      upperRight: ADULT_UPPER_RIGHT,
      upperLeft: ADULT_UPPER_LEFT,
      lowerRight: ADULT_LOWER_RIGHT,
      lowerLeft: ADULT_LOWER_LEFT,
      totalTeeth: 32,
      label: '32 зуба'
    };
  }, [dentitionType]);

  // Fetch teeth data
  const { data: teethData } = useQuery({
    queryKey: ['smart-dental-chart', patientId, currentClinic?.id],
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
    queryKey: ['dental-chart-legacy', patientId, currentClinic?.id],
    queryFn: async () => {
      if (!patientId || !currentClinic?.id) return [];
      const { data } = await supabase
        .from('dental_chart')
        .select('*')
        .eq('patient_id', patientId)
        .eq('clinic_id', currentClinic.id);
      return data || [];
    },
    enabled: !!patientId && !!currentClinic?.id,
  });

  // Merge teeth data
  const teethMap = useMemo(() => {
    const map = new Map<number, any>();
    
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
      if (!currentClinic?.id) throw new Error("Clinic ID not found");
      
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
            clinic_id: currentClinic.id
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
          clinic_id: currentClinic.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smart-dental-chart', patientId] });
      queryClient.invalidateQueries({ queryKey: ['dental-chart-legacy', patientId] });
      queryClient.invalidateQueries({ queryKey: ['tooth-history', patientId] });
      toast.success("Данные зуба сохранены");
      setEditingTooth(null);
    },
    onError: () => {
      toast.error("Ошибка сохранения");
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
              onClick={() => handleToothClick(toothNumber)}
              className={cn(
                "relative w-9 h-9 md:w-10 md:h-10 border-2 rounded-lg transition-all cursor-pointer",
                "flex items-center justify-center text-[13px] md:text-sm font-semibold",
                "hover:scale-105 hover:shadow-md hover:-translate-y-0.5",
                statusInfo.bgColor,
                isSelected && "ring-2 ring-primary ring-offset-2 scale-105 shadow-md",
                status === 'removed' && "opacity-40"
              )}
              style={{ 
                borderColor: statusInfo.color, 
                color: isHealthy ? 'hsl(var(--primary))' : statusInfo.color 
              }}
            >
              {toothNumber}
              {isProblematic && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-card/95 backdrop-blur border-border/50">
            <div className="text-sm">
              <div className="font-semibold">Зуб #{toothNumber}</div>
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {dentitionType === 'child' ? (
                <Baby className="h-5 w-5 text-pink-500" />
              ) : dentitionType === 'young' ? (
                <Blend className="h-5 w-5 text-blue-500" />
              ) : (
                <User className="h-5 w-5 text-primary" />
              )}
              <div>
                <CardTitle className="text-foreground text-base">Зубная формула</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {age} лет • {teethArrays.totalTeeth} {teethArrays.totalTeeth === 20 ? 'зубов' : teethArrays.totalTeeth === 28 ? 'зубов' : 'зуба'}
                </p>
              </div>
              {problemCount > 0 && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {problemCount} проблем
                </Badge>
              )}
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
              <TabsList className="h-8 bg-muted/50">
                <TabsTrigger value="chart" className="text-xs h-7 px-3">Простой</TabsTrigger>
                <TabsTrigger value="smart" className="text-xs h-7 px-3">Умный</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-5">
          {/* Upper Jaw */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-xs text-center font-medium">Верхняя челюсть</div>
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
            <div className="text-muted-foreground text-xs text-center font-medium">Нижняя челюсть</div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center pt-4 border-t border-border/50">
            {Object.entries(TOOTH_STATUS).slice(0, 6).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: key === 'healthy' ? 'hsl(var(--primary))' : color }} 
                />
                <span className="text-muted-foreground text-xs">{label}</span>
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
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: TOOTH_STATUS[editStatus]?.color }}
              >
                {editingTooth}
              </div>
              Зуб #{editingTooth}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Статус</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ToothStatus)}>
                <SelectTrigger className="bg-background border-border">
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
              <Label className="text-foreground">Диагноз</Label>
              <Textarea
                value={editDiagnosis}
                onChange={(e) => setEditDiagnosis(e.target.value)}
                placeholder="Опишите диагноз..."
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Заметки</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Дополнительные заметки..."
                className="bg-background border-border"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingTooth(null)}>
                <X className="h-4 w-4 mr-1" />
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
