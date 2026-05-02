import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, formatPriceFrom } from "@/lib/utils";
import { useCreateAppointmentAccess } from "@/hooks/useMedicalAccess";

interface Doctor {
  id: string;
  specialty: string;
  price_from: number;
  clinic_id?: string;
  profile?: {
    full_name: string;
  };
  clinic?: {
    id: string;
    name: string;
  };
}

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctor: Doctor;
}

const services = [
  "Консультация",
  "Лечение кариеса",
  "Чистка зубов",
  "Отбеливание",
  "Установка брекетов",
  "Имплантация",
  "Протезирование",
  "Удаление зуба",
  "Лечение десен",
];

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];

const AppointmentModal = ({ open, onOpenChange, doctor }: AppointmentModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [service, setService] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createAppointmentAccess = useCreateAppointmentAccess();

  const handleSubmit = async () => {
    if (!user || !date || !time || !service) {
      toast({
        title: "Заполните все поля",
        description: "Выберите услугу, дату и время приема",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse time and create full datetime
      const [hours, minutes] = time.split(":").map(Number);
      const appointmentDate = setMinutes(setHours(date, hours), minutes);

      const { error } = await supabase.from("appointments").insert({
        patient_id: user.id,
        doctor_id: doctor.id,
        clinic_id: null, // Will be set if doctor has clinic
        appointment_date: appointmentDate.toISOString(),
        service,
        notes: notes.trim() || null,
        price: doctor.price_from,
        status: "pending",
      });

      if (error) throw error;

      // Create auto medical access for appointment (1 hour default duration)
      const appointmentEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000);
      
      try {
        await createAppointmentAccess.mutateAsync({
          patientId: user.id,
          doctorId: doctor.id,
          clinicId: doctor.clinic?.id || undefined,
          appointmentStart: appointmentDate,
          appointmentEnd: appointmentEnd
        });
      } catch (accessError) {
        console.error("Error creating medical access:", accessError);
        // Don't fail the whole booking if access creation fails
      }

      toast({
        title: "Запись успешна!",
        description: `Вы записаны на ${format(appointmentDate, "d MMMM в HH:mm", { locale: ru })}`,
      });

      onOpenChange(false);
      resetForm();
      navigate("/appointments");
    } catch (error: any) {
      toast({
        title: "Ошибка записи",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setService("");
    setDate(undefined);
    setTime("");
    setNotes("");
  };

  const canProceedToStep2 = service !== "";
  const canProceedToStep3 = date !== undefined && time !== "";
  const canSubmit = service && date && time;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Запись к врачу</DialogTitle>
          <DialogDescription>
            {doctor.profile?.full_name} • {doctor.specialty}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
                  step >= s
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 transition-colors",
                    step > s ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Service Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label>Выберите услугу</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-4 bg-secondary rounded-lg">
              <CreditCard className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Стоимость приема</p>
                <p className="text-lg font-bold text-primary">
                  {formatPriceFrom(doctor.price_from)}
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              variant="hero"
              disabled={!canProceedToStep2}
              onClick={() => setStep(2)}
            >
              Выбрать дату и время
            </Button>
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4" />
                Выберите дату
              </Label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                initialFocus
                className={cn("rounded-md border pointer-events-auto")}
                locale={ru}
              />
            </div>

            {date && (
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  Выберите время
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant={time === slot ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTime(slot)}
                      type="button"
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Назад
              </Button>
              <Button
                variant="hero"
                disabled={!canProceedToStep3}
                onClick={() => setStep(3)}
                className="flex-1"
              >
                Продолжить
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Врач</p>
                <p className="font-semibold">{doctor.profile?.full_name}</p>
                <p className="text-sm text-primary">{doctor.specialty}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Услуга</p>
                <p className="font-semibold">{service}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дата и время</p>
                <p className="font-semibold">
                  {date && format(date, "d MMMM yyyy", { locale: ru })} в {time}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Стоимость</p>
                <p className="text-lg font-bold text-primary">
                  от {doctor.price_from.toLocaleString()} сум
                </p>
              </div>
            </div>

            <div>
              <Label>Дополнительные пожелания (необязательно)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Опишите ваши симптомы или пожелания..."
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Назад
              </Button>
              <Button
                variant="hero"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                className="flex-1"
              >
                {isSubmitting ? "Запись..." : "Подтвердить запись"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
