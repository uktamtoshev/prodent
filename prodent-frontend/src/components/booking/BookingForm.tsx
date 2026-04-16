import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateAppointmentAccess } from "@/hooks/useMedicalAccess";

interface BookingFormProps {
  doctor: any;
  userId: string;
}

const SERVICES = [
  { id: "consultation", name: "Консультация", price: 50000 },
  { id: "cleaning", name: "Профессиональная чистка", price: 150000 },
  { id: "whitening", name: "Отбеливание", price: 500000 },
  { id: "filling", name: "Лечение кариеса", price: 200000 },
  { id: "extraction", name: "Удаление зуба", price: 150000 },
  { id: "implant", name: "Имплантация", price: 3000000 },
];

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00"
];

export function BookingForm({ doctor, userId }: BookingFormProps) {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const createAppointmentAccess = useCreateAppointmentAccess();

  const selectedServiceData = SERVICES.find(s => s.id === selectedService);

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedTime) {
      toast.error("Пожалуйста, заполните все поля");
      return;
    }

    setLoading(true);

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const appointmentDate = setMinutes(setHours(selectedDate, hours), minutes);

    const { error } = await supabase.from("appointments").insert({
      doctor_id: doctor.id,
      clinic_id: doctor.clinic_id,
      patient_id: userId,
      appointment_date: appointmentDate.toISOString(),
      service: selectedServiceData?.name || "",
      price: selectedServiceData?.price || 0,
      notes: notes,
      status: "pending",
    });

    if (error) {
      setLoading(false);
      toast.error("Ошибка создания записи: " + error.message);
      return;
    }

    // Create auto medical access for appointment (1 hour default duration)
    const appointmentEnd = new Date(appointmentDate.getTime() + 60 * 60 * 1000);
    
    try {
      await createAppointmentAccess.mutateAsync({
        patientId: userId,
        doctorId: doctor.id,
        clinicId: doctor.clinic_id,
        appointmentStart: appointmentDate,
        appointmentEnd: appointmentEnd
      });
    } catch (accessError) {
      console.error("Error creating medical access:", accessError);
      // Don't fail the whole booking if access creation fails
    }

    setLoading(false);
    setConfirmed(true);
    toast.success("Запись успешно создана!");
  };

  if (confirmed) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-2">Запись подтверждена!</h3>
        <p className="text-slate-300 mb-4">
          Вы записаны на {format(selectedDate!, "d MMMM yyyy", { locale: ru })} в {selectedTime}
        </p>
        <p className="text-slate-400 mb-6">
          Услуга: {selectedServiceData?.name} - {selectedServiceData?.price.toLocaleString()} сум
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/appointments")} variant="outline">
            Мои записи
          </Button>
          <Button onClick={() => navigate("/")}>
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Service Selection */}
      <div>
        <Label className="text-white text-lg mb-3 block">1. Выберите услугу</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SERVICES.map((service) => (
            <button
              key={service.id}
              onClick={() => setSelectedService(service.id)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                selectedService === service.id
                  ? "border-primary bg-primary/10"
                  : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
              }`}
            >
              <div className="font-medium text-white">{service.name}</div>
              <div className="text-sm text-slate-400 mt-1">
                {service.price.toLocaleString()} сум
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Date Selection */}
      {selectedService && (
        <div>
          <Label className="text-white text-lg mb-3 block">2. Выберите дату</Label>
          <div className="bg-slate-700/50 rounded-lg p-4 inline-block">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
              locale={ru}
              className="text-white"
            />
          </div>
        </div>
      )}

      {/* Step 3: Time Selection */}
      {selectedDate && (
        <div>
          <Label className="text-white text-lg mb-3 block">3. Выберите время</Label>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {TIME_SLOTS.map((time) => (
              <button
                key={time}
                onClick={() => setSelectedTime(time)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  selectedTime === time
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-slate-600 bg-slate-700/50 text-white hover:border-slate-500"
                }`}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Notes */}
      {selectedTime && (
        <div>
          <Label htmlFor="notes" className="text-white text-lg mb-3 block">
            4. Дополнительная информация (необязательно)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Опишите ваши жалобы или особые пожелания..."
            className="bg-slate-700 border-slate-600 text-white min-h-[100px]"
          />
        </div>
      )}

      {/* Submit Button */}
      {selectedService && selectedDate && selectedTime && (
        <div className="pt-4 border-t border-slate-700">
          <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
            <h4 className="text-white font-semibold mb-2">Детали записи:</h4>
            <div className="space-y-1 text-sm text-slate-300">
              <p>Услуга: {selectedServiceData?.name}</p>
              <p>Дата: {format(selectedDate, "d MMMM yyyy, EEEE", { locale: ru })}</p>
              <p>Время: {selectedTime}</p>
              <p className="text-white font-medium mt-2">
                Стоимость: {selectedServiceData?.price.toLocaleString()} сум
              </p>
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} size="lg" className="w-full">
            {loading ? "Создание записи..." : "Подтвердить запись"}
          </Button>
        </div>
      )}
    </div>
  );
}
