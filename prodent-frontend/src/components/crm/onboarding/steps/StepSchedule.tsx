import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useClinic } from "@/contexts/ClinicContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Json } from "@/integrations/supabase/types";

const DAYS = [
  { key: "monday", label: "Пн" },
  { key: "tuesday", label: "Вт" },
  { key: "wednesday", label: "Ср" },
  { key: "thursday", label: "Чт" },
  { key: "friday", label: "Пт" },
  { key: "saturday", label: "Сб" },
  { key: "sunday", label: "Вс" },
];

interface StepScheduleProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepSchedule({ onNext, onBack, onSkip }: StepScheduleProps) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [workDays, setWorkDays] = useState<Record<string, boolean>>({
    monday: true, tuesday: true, wednesday: true, thursday: true, friday: true,
    saturday: true, sunday: false,
  });
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");

  const toggleDay = (day: string) => {
    setWorkDays({ ...workDays, [day]: !workDays[day] });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!currentClinic?.id) throw new Error("No clinic");

      const schedule: Record<string, any> = {};
      DAYS.forEach((day) => {
        schedule[day.key] = {
          enabled: workDays[day.key],
          start: startTime,
          end: endTime,
        };
      });

      await supabase.from("clinic_settings").upsert(
        [{
          clinic_id: currentClinic.id,
          key: "working_hours",
          value: schedule as unknown as Json,
          description: "Рабочие часы клиники",
        }],
        { onConflict: "clinic_id,key" }
      );

      toast({ title: "Расписание настроено ✓" });
      onNext();
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">Настройте расписание</CardTitle>
        <CardDescription>Выберите рабочие дни и часы клиники</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Working days */}
        <div>
          <Label className="mb-3 block">Рабочие дни</Label>
          <div className="flex gap-2 justify-center">
            {DAYS.map((day) => (
              <button
                key={day.key}
                onClick={() => toggleDay(day.key)}
                className={cn(
                  "w-11 h-11 rounded-full text-sm font-medium transition-all",
                  workDays[day.key]
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>

        {/* Working hours */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Начало работы</Label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {Array.from({ length: 13 }, (_, i) => i + 6).map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Конец работы</Label>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full mt-1 rounded-lg border border-border bg-input px-3 py-2 text-sm"
            >
              {Array.from({ length: 13 }, (_, i) => i + 12).map((h) => (
                <option key={h} value={`${String(h).padStart(2, "0")}:00`}>
                  {String(h).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          💡 Вы сможете настроить индивидуальное расписание для каждого врача позже в разделе «Настройки».
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1">Назад</Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1">Пропустить</Button>
          <Button onClick={handleSave} className="flex-1" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Далее
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
