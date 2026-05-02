import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DentalChartProps {
  patientId: string;
}

const TOOTH_STATUS = {
  healthy: { label: "Здоров", color: "bg-emerald-500/20 border-emerald-500 text-emerald-400" },
  caries: { label: "Кариес", color: "bg-red-500/20 border-red-500 text-red-400" },
  filling: { label: "Пломба", color: "bg-blue-500/20 border-blue-500 text-blue-400" },
  crown: { label: "Коронка", color: "bg-amber-500/20 border-amber-500 text-amber-400" },
  implant: { label: "Имплант", color: "bg-purple-500/20 border-purple-500 text-purple-400" },
  removed: { label: "Удален", color: "bg-muted/50 border-muted-foreground/50 text-muted-foreground line-through" },
};

export function DentalChart({ patientId }: DentalChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("healthy");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Загружаем clinic_id
  const { data: clinicData } = useQuery({
    queryKey: ["user-clinic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();
      return data;
    },
  });

  // Загружаем данные зубной формулы
  const { data: dentalData } = useQuery({
    queryKey: ["dental-chart", patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("dental_chart")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicData?.clinic_id);
      return data || [];
    },
    enabled: !!clinicData?.clinic_id,
  });

  // Мутация для сохранения данных
  const saveMutation = useMutation({
    mutationFn: async (toothNumber: number) => {
      if (!clinicData?.clinic_id) throw new Error("Clinic ID not found");
      
      const existing = dentalData?.find((d) => d.tooth_number === toothNumber);

      if (existing) {
        const { error } = await supabase
          .from("dental_chart")
          .update({ status, diagnosis, notes })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("dental_chart")
          .insert({ 
            patient_id: patientId, 
            tooth_number: toothNumber, 
            status, 
            diagnosis, 
            notes,
            clinic_id: clinicData.clinic_id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dental-chart", patientId] });
      toast.success("Данные зуба сохранены");
      setSelectedTooth(null);
    },
    onError: () => {
      toast.error("Ошибка сохранения");
    },
  });

  const handleToothClick = (toothNumber: number) => {
    const toothData = dentalData?.find((d) => d.tooth_number === toothNumber);
    setSelectedTooth(toothNumber);
    setStatus(toothData?.status || "healthy");
    setDiagnosis(toothData?.diagnosis || "");
    setNotes(toothData?.notes || "");
  };

  const handleSave = () => {
    if (selectedTooth) {
      saveMutation.mutate(selectedTooth);
    }
  };

  const getToothColor = (toothNumber: number) => {
    const toothData = dentalData?.find((d) => d.tooth_number === toothNumber);
    const statusKey = (toothData?.status || "healthy") as keyof typeof TOOTH_STATUS;
    return TOOTH_STATUS[statusKey]?.color || TOOTH_STATUS.healthy.color;
  };

  const renderTooth = (toothNumber: number) => {
    const toothData = dentalData?.find((d) => d.tooth_number === toothNumber);
    const statusKey = (toothData?.status || "healthy") as keyof typeof TOOTH_STATUS;
    const statusInfo = TOOTH_STATUS[statusKey] || TOOTH_STATUS.healthy;
    
    return (
      <TooltipProvider key={toothNumber}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleToothClick(toothNumber)}
              className={`w-12 h-16 border-2 rounded-lg transition-all hover:scale-110 cursor-pointer flex items-center justify-center text-sm font-semibold ${statusInfo.color}`}
            >
              {toothNumber}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-semibold">Зуб #{toothNumber}</div>
              <div>Статус: {statusInfo.label}</div>
              {toothData?.diagnosis && <div className="text-xs text-muted-foreground">{toothData.diagnosis}</div>}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Верхняя челюсть: 18-11 (справа налево), 21-28 (слева направо)
  const upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeft = [21, 22, 23, 24, 25, 26, 27, 28];
  
  // Нижняя челюсть: 48-41 (справа налево), 31-38 (слева направо)
  const lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
  const lowerLeft = [31, 32, 33, 34, 35, 36, 37, 38];

  return (
    <>
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Зубная формула</CardTitle>
          <p className="text-muted-foreground text-sm">Кликните на зуб для редактирования статуса</p>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Верхняя челюсть */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm text-center">Верхняя челюсть</div>
            <div className="flex justify-center gap-1">
              <div className="flex gap-1">{upperRight.map(renderTooth)}</div>
              <div className="w-4" />
              <div className="flex gap-1">{upperLeft.map(renderTooth)}</div>
            </div>
          </div>

          {/* Нижняя челюсть */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-sm text-center">Нижняя челюсть</div>
            <div className="flex justify-center gap-1">
              <div className="flex gap-1">{lowerRight.map(renderTooth)}</div>
              <div className="w-4" />
              <div className="flex gap-1">{lowerLeft.map(renderTooth)}</div>
            </div>
          </div>

          {/* Легенда */}
          <div className="flex flex-wrap gap-4 justify-center pt-4 border-t border-border">
            {Object.entries(TOOTH_STATUS).map(([key, { label, color }]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded border-2 ${color.split(' ').slice(0, 2).join(' ')}`} />
                <span className="text-muted-foreground text-sm">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Диалог редактирования зуба */}
      <Dialog open={selectedTooth !== null} onOpenChange={() => setSelectedTooth(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Зуб #{selectedTooth}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Статус</Label>
              <Select value={status} onValueChange={setStatus}>
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
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Опишите диагноз..."
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Заметки</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Дополнительные заметки..."
                className="bg-background border-border"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setSelectedTooth(null)}>
                Отмена
              </Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
