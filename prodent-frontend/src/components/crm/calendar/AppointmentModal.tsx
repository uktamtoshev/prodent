import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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
  CalendarClock,
  UserX
} from "lucide-react";
import { AppointmentData, APPOINTMENT_STATUSES, getAppointmentTime, getStatusStyle } from "./appointmentConstants";
import { GuestBadge } from "../patients/GuestBadge";
import { useLanguage } from "@/contexts/LanguageContext";
import { placeAppointment, setAppointmentStatus } from "@/lib/appointment-api";

interface AppointmentModalProps {
  appointment: AppointmentData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const AppointmentModal = ({ appointment, open, onOpenChange, onUpdate }: AppointmentModalProps) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [status, setStatus] = useState((appointment?.status || "PENDING").toUpperCase());
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(
    appointment ? new Date(appointment.appointment_date) : undefined
  );
  const [rescheduleTime, setRescheduleTime] = useState(
    appointment ? getAppointmentTime(appointment) : "09:00"
  );

  useEffect(() => {
    if (appointment) {
      setNotes(appointment.notes || "");
      setStatus(appointment.status.toUpperCase());
      setRescheduleDate(new Date(appointment.appointment_date));
      setRescheduleTime(
        getAppointmentTime(appointment)
      );
      setShowReschedule(false);
    }
  }, [appointment]);

  if (!appointment) return null;

  const statusStyle = getStatusStyle(status);

  const updateAppointment = async (newStatus?: string, newNotes?: string) => {
    try {
      setLoading(true);
      if (newStatus !== undefined) {
        await setAppointmentStatus({
          appointmentId: appointment.id,
          status: newStatus,
        });
      } else if (newNotes !== undefined) {
        await placeAppointment({
          appointmentId: appointment.id,
          doctorId: appointment.doctor_id,
          roomId: appointment.room_id ?? null,
          appointmentDate: format(new Date(appointment.appointment_date), "yyyy-MM-dd"),
          startTime:
            getAppointmentTime(appointment),
          notes: newNotes,
        });
      }

      toast.success(t('crmApptModal.recordUpdated'));
      onUpdate();
      if (newStatus) setStatus(newStatus.toUpperCase());
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error(t('crmApptModal.updateError'));
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
      toast.error(t('crmApptModal.selectDate'));
      return;
    }

    try {
      setLoading(true);

      const [hours, minutes] = rescheduleTime.split(":").map(Number);
      const newDate = new Date(rescheduleDate);
      newDate.setHours(hours, minutes, 0, 0);

      await placeAppointment({
        appointmentId: appointment.id,
        doctorId: appointment.doctor_id,
        roomId: appointment.room_id ?? null,
        appointmentDate: format(newDate, "yyyy-MM-dd"),
        startTime: rescheduleTime,
      });

      toast.success(t('crmApptModal.recordRescheduled'), {
        description: `${t('crmApptModal.newTime')}: ${format(newDate, "d MMMM HH:mm", { locale: ru })}`,
      });
      setShowReschedule(false);
      onUpdate();
    } catch (error) {
      console.error("Error rescheduling:", error);
      toast.error(t('crmApptModal.rescheduleError'));
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { status: "CONFIRMED", label: t('crmApptModal.confirm'), icon: Check, color: "text-status-info" },
    { status: "CANCELLED", label: t('crmApptModal.cancelStatus'), icon: X, color: "text-status-danger" },
    { status: "NO_SHOW", label: t('crmApptModal.noShow'), icon: UserX, color: "text-status-warning" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {t('crmApptModal.detailsTitle')}
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
                    {appointment.guest_patients?.name || appointment.profiles?.full_name || t('crmApptModal.unknownPatient')}
                  </p>
                  {appointment.guest_patient_id && <GuestBadge size="sm" />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {appointment.guest_patient_id ? t('crmApptModal.guest') : t('crmApptModal.patient')}
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
                {getAppointmentTime(appointment)}
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
              <span className="text-muted-foreground">{t('crmApptModal.doctorLabel')}:</span>
              <span className="font-medium">{appointment.doctors.profiles.full_name}</span>
            </div>
          )}

          {/* Price */}
          {appointment.price && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('crmApptModal.priceLabel')}:</span>
              <span className="font-medium">{appointment.price.toLocaleString()} UZS</span>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label>{t('crmApptModal.quickActions')}</Label>
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
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                {t('crmApptModal.rescheduleBtn')}
              </Button>
            </div>
          </div>

          {/* Reschedule Panel */}
          {showReschedule && (
            <div className="bg-status-info-bg rounded-lg p-4 space-y-4 border border-status-info/30">
              <Label className="flex items-center gap-2 text-status-info">
                <CalendarClock className="h-4 w-4" />
                {t('crmApptModal.reschedulePanelTitle')}
              </Label>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">{t('crmApptModal.newDate')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {rescheduleDate
                          ? format(rescheduleDate, "d MMM yyyy", { locale: ru })
                          : t('crmApptModal.selectDate')}
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
                  <Label className="text-sm" htmlFor="appointment-modal-field-1">{t('crmApptModal.newTime')}</Label>
                  <Input id="appointment-modal-field-1"
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
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReschedule(false)}
                  disabled={loading}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {/* Status Select */}
          <div className="space-y-2">
            <Label>{t('crmApptModal.changeStatus')}</Label>
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
            <Label className="flex items-center gap-2" htmlFor="appointment-modal-field-2">
              <FileText className="h-4 w-4" />
              {t('crmApptModal.commentLabel')}
            </Label>
            <Textarea id="appointment-modal-field-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('crmApptModal.commentPlaceholder')}
              rows={3}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNotes}
              disabled={loading || notes === appointment.notes}
            >
              {t('crmApptModal.saveComment')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
