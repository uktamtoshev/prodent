import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { createAppointment } from "@/lib/appointment-api";
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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn, formatPriceFrom } from "@/lib/utils";

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

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
];

const AppointmentModal = ({ open, onOpenChange, doctor }: AppointmentModalProps) => {
  const { t } = useLanguage();
  const services = useMemo(() => [
    t('doctorAppointmentModal.svcConsultation'),
    t('doctorAppointmentModal.svcCariesTreatment'),
    t('doctorAppointmentModal.svcCleaning'),
    t('doctorAppointmentModal.svcWhitening'),
    t('doctorAppointmentModal.svcBraces'),
    t('doctorAppointmentModal.svcImplantation'),
    t('doctorAppointmentModal.svcProsthetics'),
    t('doctorAppointmentModal.svcExtraction'),
    t('doctorAppointmentModal.svcGumTreatment'),
  ], [t]);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [service, setService] = useState("");
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || !date || !time || !service) {
      toast({
        title: t('doctorAppointmentModal.fillAllFields'),
        description: t('doctorAppointmentModal.selectServiceDateTime'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Parse time and create full datetime
      const [hours, minutes] = time.split(":").map(Number);
      const appointmentDate = setMinutes(setHours(date, hours), minutes);

      await createAppointment({
        patientId: user.id,
        doctorId: doctor.id,
        clinicId: doctor.clinic?.id || undefined,
        serviceName: service,
        appointmentDate: format(appointmentDate, "yyyy-MM-dd"),
        startTime: time,
        notes: notes.trim() || undefined,
      });

      toast({
        title: t('doctorAppointmentModal.bookingSuccess'),
        description: `${t('doctorAppointmentModal.bookedFor')} ${format(appointmentDate, "d MMMM", { locale: ru })} ${t('doctorAppointmentModal.atTime')} ${format(appointmentDate, "HH:mm")}`,
      });

      onOpenChange(false);
      resetForm();
      navigate("/appointments");
    } catch (error: unknown) {
      toast({
        title: t('doctorAppointmentModal.bookingError'),
        description: error instanceof Error ? error.message : t('doctorAppointmentModal.bookingError'),
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
          <DialogTitle className="text-2xl">{t('doctorAppointmentModal.bookTitle')}</DialogTitle>
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
              <Label>{t('doctorAppointmentModal.selectService')}</Label>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t('doctorAppointmentModal.selectService')} />
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
                <p className="text-sm font-medium">{t('doctorAppointmentModal.visitCost')}</p>
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
              {t('doctorAppointmentModal.pickDateTime')}
            </Button>
          </div>
        )}

        {/* Step 2: Date & Time Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4" />
                {t('doctorAppointmentModal.pickDate')}
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
                  {t('doctorAppointmentModal.pickTime')}
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
                {t('doctorAppointmentModal.back')}
              </Button>
              <Button
                variant="hero"
                disabled={!canProceedToStep3}
                onClick={() => setStep(3)}
                className="flex-1"
              >
                {t('doctorAppointmentModal.continue')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorAppointmentModal.doctorLabel')}</p>
                <p className="font-semibold">{doctor.profile?.full_name}</p>
                <p className="text-sm text-primary">{doctor.specialty}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorAppointmentModal.serviceLabel')}</p>
                <p className="font-semibold">{service}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorAppointmentModal.dateTimeLabel')}</p>
                <p className="font-semibold">
                  {date && format(date, "d MMMM yyyy", { locale: ru })} {t('doctorAppointmentModal.atTime')} {time}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorAppointmentModal.costLabel')}</p>
                <p className="text-lg font-bold text-primary">
                  {t('doctorAppointmentModal.fromPriceSum')} {doctor.price_from.toLocaleString()} {t('doctorAppointmentModal.sumSuffix')}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="appointment-modal-field-1">{t('doctorAppointmentModal.additionalWishes')}</Label>
              <Textarea id="appointment-modal-field-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('doctorAppointmentModal.wishesPh')}
                rows={3}
                className="mt-2"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                {t('doctorAppointmentModal.back')}
              </Button>
              <Button
                variant="hero"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
                className="flex-1"
              >
                {isSubmitting ? t('doctorAppointmentModal.booking') : t('doctorAppointmentModal.confirmBooking')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
