import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { VoiceRecorder } from "./VoiceRecorder";

interface MedicalRecordFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  doctorId: string;
  onSuccess: () => void;
}

export function MedicalRecordForm({
  open,
  onOpenChange,
  patientId,
  doctorId,
  onSuccess,
}: MedicalRecordFormProps) {
  const [saving, setSaving] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [examination, setExamination] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [nextVisitDate, setNextVisitDate] = useState<Date>();
  const [voiceNotes, setVoiceNotes] = useState<string[]>([]);

  const handleSave = async () => {
    if (!chiefComplaint || !diagnosis) {
      toast.error("Заполните обязательные поля: жалобы и диагноз");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        patient_id: patientId,
        doctor_id: doctorId,
        chief_complaint: chiefComplaint,
        examination,
        diagnosis,
        treatment_provided: treatment,
        recommendations,
        next_visit_date: nextVisitDate?.toISOString(),
        voice_notes: voiceNotes,
        visit_date: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Медицинская запись сохранена");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setChiefComplaint("");
    setExamination("");
    setDiagnosis("");
    setTreatment("");
    setRecommendations("");
    setNextVisitDate(undefined);
    setVoiceNotes([]);
  };

  const handleVoiceNoteAdded = (url: string) => {
    setVoiceNotes([...voiceNotes, url]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая медицинская запись</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>
              Жалобы пациента <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Опишите жалобы пациента..."
              className="bg-slate-700 border-slate-600"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Объективный осмотр</Label>
            <Textarea
              value={examination}
              onChange={(e) => setExamination(e.target.value)}
              placeholder="Результаты осмотра..."
              className="bg-slate-700 border-slate-600"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Диагноз <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Поставленный диагноз..."
              className="bg-slate-700 border-slate-600"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Проведенное лечение</Label>
            <Textarea
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="Описание проведенного лечения..."
              className="bg-slate-700 border-slate-600"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Рекомендации</Label>
            <Textarea
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Рекомендации для пациента..."
              className="bg-slate-700 border-slate-600"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Дата следующего визита</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-slate-700 border-slate-600",
                    !nextVisitDate && "text-slate-400"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextVisitDate ? format(nextVisitDate, "PPP", { locale: ru }) : "Выберите дату"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700" align="start">
                <Calendar
                  mode="single"
                  selected={nextVisitDate}
                  onSelect={setNextVisitDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Голосовые заметки</Label>
            <VoiceRecorder patientId={patientId} onVoiceNoteAdded={handleVoiceNoteAdded} />
            {voiceNotes.length > 0 && (
              <div className="text-sm text-slate-400">
                Добавлено голосовых заметок: {voiceNotes.length}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-600"
            >
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Сохранение..." : "Сохранить запись"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
