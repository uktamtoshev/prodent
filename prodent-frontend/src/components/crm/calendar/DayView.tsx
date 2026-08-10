import { useState, useEffect, useCallback } from "react";
import { format, addHours, startOfDay, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraggableAppointmentCard } from "./DraggableAppointmentCard";
import { DroppableTimeSlot } from "./DroppableTimeSlot";
import { AppointmentModal } from "./AppointmentModal";
import { AppointmentData, APPOINTMENT_STATUSES, appointmentMatchesStatus, getAppointmentHour } from "./appointmentConstants";
import { useLanguage } from "@/contexts/LanguageContext";
import { placeAppointment } from "@/lib/appointment-api";
import { a11yLabel } from "@/lib/a11y-labels";

interface DayViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Doctor {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
}

export const DayView = ({ selectedDate, onDateChange }: DayViewProps) => {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

  const loadDoctors = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("doctors")
        .select(`
          id,
          user_id,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .eq("clinic_id", currentClinic!.id);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error(t('crmDayView.doctorsLoadError'));
    }
  }, [currentClinic, t]);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const startOfDayDate = startOfDay(selectedDate);
      const endOfDayDate = addHours(startOfDayDate, 24);

      // First get personal patient IDs (patients of chair_rental doctors)
      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);
      
      const personalPatientIds = new Set(personalPatients?.map(p => p.user_id) || []);

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          room_id,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          total_price,
          profiles:patient_id (
            full_name,
            phone
          ),
          doctors:doctor_id (
            cooperation_type
          )
        `)
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", startOfDayDate.toISOString())
        .lt("appointment_date", endOfDayDate.toISOString())
        .order("appointment_date");

      if (error) throw error;
      
      // Mark appointments with personal patients
      const appointmentsWithType = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id) || 
          apt.doctors?.cooperation_type === 'chair_rental'
      }));
      
      setAppointments(appointmentsWithType);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error(t('crmDayView.apptsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [currentClinic, selectedDate, t]);

  useEffect(() => {
    if (currentClinic) {
      loadDoctors();
      loadAppointments();
    }
  }, [currentClinic, loadAppointments, loadDoctors]);

  const checkDoctorAvailability = async (doctorId: string, newDate: Date, excludeAppointmentId: string) => {
    const startOfHour = new Date(newDate);
    startOfHour.setMinutes(0, 0, 0);
    const endOfHour = addHours(startOfHour, 1);

    const { data, error } = await supabase
      .from("appointments")
      .select("id")
      .eq("doctor_id", doctorId)
      .eq("clinic_id", currentClinic!.id)
      .neq("id", excludeAppointmentId)
      .neq("status", "cancelled")
      .gte("appointment_date", startOfHour.toISOString())
      .lt("appointment_date", endOfHour.toISOString());

    if (error) throw error;
    return (data || []).length === 0;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const [doctorId, hourStr] = (over.id as string).split("-");
    const hour = parseInt(hourStr);

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const newDate = setMinutes(setHours(new Date(selectedDate), hour), 0);

    try {
      // Check availability
      const isAvailable = await checkDoctorAvailability(doctorId, newDate, appointmentId);
      if (!isAvailable) {
        toast.error(t('crmDayView.doctorBusy'));
        return;
      }

      await placeAppointment({
        appointmentId,
        doctorId,
        roomId: appointment.room_id ?? null,
        appointmentDate: format(newDate, "yyyy-MM-dd"),
        startTime: format(newDate, "HH:mm"),
      });

      toast.success(t('crmDayView.apptMoved'));
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error(t('crmDayView.moveApptError'));
    }
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  const filteredDoctors = selectedDoctor === "all" 
    ? doctors 
    : doctors.filter(d => d.id === selectedDoctor);

  const getAppointmentsForDoctorAndHour = (doctorId: string, hour: number) => {
    return appointments.filter((apt) => {
      const matchesDoctor = apt.doctor_id === doctorId;
      const matchesHour = getAppointmentHour(apt) === hour;
      const matchesStatus = appointmentMatchesStatus(apt.status, selectedStatus);
      return matchesDoctor && matchesHour && matchesStatus;
    });
  };

  const activeAppointment = activeId ? appointments.find(a => a.id === activeId) : null;

  return (
    <DndContext 
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousDay} aria-label={a11yLabel("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              {t('crmDayView.today')}
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextDay} aria-label={a11yLabel("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-base font-bold ml-2">
              {format(selectedDate, "d MMMM yyyy, EEEE", { locale: ru })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('crmDayView.allDoctors')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('crmDayView.allDoctors')}</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.profiles?.full_name || t('crmDayView.doctorFallback')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('crmDayView.allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('crmDayView.allStatuses')}</SelectItem>
                {Object.entries(APPOINTMENT_STATUSES).map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="grid bg-muted/50" style={{ gridTemplateColumns: `100px repeat(${filteredDoctors.length}, minmax(200px, 1fr))` }}>
            <div className="p-3 border-r font-medium text-sm">{t('crmDayView.time')}</div>
            {filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="p-3 border-r font-medium text-center text-sm">
                {doctor.profiles?.full_name || t('crmDayView.doctorFallback')}
              </div>
            ))}
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid border-t"
                style={{ gridTemplateColumns: `100px repeat(${filteredDoctors.length}, minmax(200px, 1fr))` }}
              >
                <div className="p-3 border-r text-sm text-muted-foreground font-medium">
                  {`${hour}:00`}
                </div>
                {filteredDoctors.map((doctor) => (
                  <DroppableTimeSlot key={`${doctor.id}-${hour}`} id={`${doctor.id}-${hour}`}>
                    {getAppointmentsForDoctorAndHour(doctor.id, hour).map((apt) => (
                      <DraggableAppointmentCard
                        key={apt.id}
                        appointment={apt}
                        onUpdate={loadAppointments}
                        onClick={() => {
                          setSelectedAppointment(apt);
                          setIsModalOpen(true);
                        }}
                      />
                    ))}
                  </DroppableTimeSlot>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className="opacity-80">
            <DraggableAppointmentCard
              appointment={activeAppointment}
              onUpdate={() => {}}
            />
          </div>
        )}
      </DragOverlay>

      <AppointmentModal
        appointment={selectedAppointment}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdate={loadAppointments}
      />
    </DndContext>
  );
};
