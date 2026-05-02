import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  User, 
  Phone, 
  Calendar, 
  Clock, 
  Stethoscope,
  FileText,
  Check,
  X,
  CheckCircle2,
  CalendarClock
} from "lucide-react";
import { AppointmentData, APPOINTMENT_STATUSES, getStatusStyle, AppointmentStatus, GUEST_PATIENT_STYLE } from "./appointmentConstants";
import { GuestBadge } from "../patients/GuestBadge";

interface AppointmentModalProps {
  appointment: AppointmentData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const AppointmentModal = ({ appointment, open, onOpenChange, onUpdate }: AppointmentModalProps) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [status, setStatus] = useState(appointment?.status || "pending");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    appointment ? new Date(appointment.appointment_date) : undefined
  );
  const [rescheduleTime, setRescheduleTime] = useState(
    appointment ? format(new Date(appointment.appointment_date), "HH:mm") : "09:00"
  );

  useEffect(() => {
    if (appointment) {
      setNotes(appointment.notes || "");
      setStatus(appointment.status);
      setRescheduleDate(new Date(appointment.appointment_date));
      setRescheduleTime(format(new Date(appointment.appointment_date), "HH:mm"));
      setShowReschedule(false);
    }
  }, [appointment]);

  if (!appointment) return null;

  const statusStyle = getStatusStyle(appointment.status);

  const updateAppointment = async (newStatus?: string, newNotes?: string) => {
    try {
      setLoading(true);
      
      const updateData: Record<string, any> = {};
      if (newStatus !== undefined) updateData.status = newStatus;
      if (newNotes !== undefined) updateData.notes = newNotes;

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (error) throw error;

      // Create notification for patient
      if (newStatus) {
        const statusLabel = APPOINTMENT_STATUSES[newStatus as AppointmentStatus]?.label || newStatus;
        await supabase.from("notifications").insert({
          user_id: appointment.patient_id,
          type: "internal",
          title: "Изменение статуса записи",
          message: `Статус вашей записи изменён на: ${statusLabel}`,
          metadata: { appointment_id: appointment.id },
        });
      }

      toast.success("Запись обновлена");
      onUpdate();
      if (newStatus) setStatus(newStatus);
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Ошибка обновления записи");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    updateAppointment(newStatus);
  };

  const handleSaveNotes = () => {
    updateAppointment(undefined, notes);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) {
      toast.error("Выберите дату");
      return;
    }
    
    try {
      setLoading(true);
      
      const [hours, minutes] = rescheduleTime.split(":").map(Number);
      const newDate = new Date(rescheduleDate);
      newDate.setHours(hours, minutes, 0, 0);

      const { error } = await supabase
        .from("appointments")
        .update({ appointment_date: newDate.toISOString() })
        .eq("id", appointment.id);

      if (error) throw error;

      toast.success("Запись перенесена", {
        description: `Новое время: ${format(newDate, "d MMMM в HH:mm", { locale: ru })}`,
      });
      setShowReschedule(false);
      onUpdate();
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast.error("Ошибка переноса записи");
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { status: "confirmed", label: "Подтвердить", icon: Check, color: "text-indigo-600" },
    { status: "completed", label: "Завершить", icon: CheckCircle2, color: "text-green-600" },
    { status: "cancelled", label: "Отменить", icon: X, color: "text-red-600" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Детали записи
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={`${statusStyle.bgColor} ${statusStyle.color} ${statusStyle.borderColor} border`}>
              {statusStyle.label}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(appointment.appointment_date), "d MMMM yyyy", { locale: ru })}
            </span>
          </div>

          {/* Patient Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {appointment.guest_patients?.name || appointment.profiles?.full_name || "Неизвестный пациент"}
                  </p>
                  {appointment.guest_patient_id && <GuestBadge size="sm" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {appointment.guest_patient_id ? "Гость" : "Пациент"}
                </p>
              </div>
            </div>
            {(appointment.guest_patients?.phone || appointment.profiles?.phone) && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span>{appointment.guest_patients?.phone || appointment.profiles?.phone}</span>
              </div>
            )}
          </div>

          {/* Appointment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(appointment.appointment_date), "HH:mm", { locale: ru })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <span>{appointment.service}</span>
            </div>
          </div>

          {/* Doctor */}
          {appointment.doctors?.profiles?.full_name && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Врач:</span>
              <span className="font-medium">{appointment.doctors.profiles.full_name}</span>
            </div>
          )}

          {/* Price */}
          {appointment.price && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Стоимость:</span>
              <span className="font-medium">{appointment.price.toLocaleString()} UZS</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label>Быстрые действия</Label>
            <div className="flex flex-wrap gap-2">
              {quickActions
                .filter(action => action.status !== status)
                .map((action) => (
                  <Button
                    key={action.status}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange(action.status)}
                    disabled={loading}
                    className="gap-1"
                  >
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                    {action.label}
                  </Button>
                ))}
              {/* Reschedule Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReschedule(!showReschedule)}
                disabled={loading}
                className="gap-1"
              >
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Перенести
              </Button>
            </div>
          </div>

          {/* Reschedule Panel */}
          {showReschedule && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-4 border border-blue-200 dark:border-blue-800">
              <Label className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <CalendarClock className="h-4 w-4" />
                Перенос записи
              </Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Новая дата</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {rescheduleDate
                          ? format(rescheduleDate, "d MMM yyyy", { locale: ru })
                          : "Выберите дату"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={rescheduleDate}
                        onSelect={setRescheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm">Новое время</Label>
                  <Input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleReschedule}
                  disabled={loading}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  Сохранить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReschedule(false)}
                  disabled={loading}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {/* Status Select */}
          <div className="space-y-2">
            <Label>Изменить статус</Label>
            <Select value={status} onValueChange={handleStatusChange} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Комментарий
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Добавьте комментарий к записи..."
              rows={3}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSaveNotes}
              disabled={loading || notes === appointment.notes}
            >
              Сохранить комментарий
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
