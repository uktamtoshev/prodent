import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, endOfWeek, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import { AppointmentModal } from "../calendar/AppointmentModal";
import { AppointmentData } from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";

interface WeekScheduleViewProps {
  selectedDate: Date;
  searchQuery: string;
  selectedDoctor: string;
  selectedStatus: string;
}

export const WeekScheduleView = ({
  selectedDate,
  searchQuery,
  selectedDoctor,
  selectedStatus,
}: WeekScheduleViewProps) => {
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (currentClinic) {
      loadAppointments();
    }
  }, [currentClinic, selectedDate]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const weekEnd = endOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 });

      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);

      const personalPatientIds = new Set(personalPatients?.map(p => p.user_id) || []);

      let query = supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          guest_patient_id,
          price,
          profiles:patient_id (
            full_name,
            phone
          ),
          guest_patients:guest_patient_id (
            id,
            name,
            phone,
            status
          ),
          doctors:doctor_id (
            cooperation_type
          )
        `)
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", weekStart.toISOString())
        .lte("appointment_date", addHours(weekEnd, 24).toISOString())
        .order("appointment_date");

      const { data, error } = await query;

      if (error) throw error;

      const appointmentsWithType = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id || '') ||
          (apt.doctors as any)?.cooperation_type === 'chair_rental',
        isGuestPatient: !!apt.guest_patient_id
      }));

      setAppointments(appointmentsWithType);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const [dayIndex] = (over.id as string).split("-");
    const targetDay = days[parseInt(dayIndex)];

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const originalTime = new Date(appointment.appointment_date);
    const newDate = setMinutes(setHours(targetDay, originalTime.getHours()), originalTime.getMinutes());

    try {
      const { error } = await supabase
        .from("appointments")
        .update({ appointment_date: newDate.toISOString() })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Запись перенесена");
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error("Ошибка переноса записи");
    }
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return startOfDay(day).getTime() === startOfDay(today).getTime();
  };

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      const matchesDay = startOfDay(aptDate).getTime() === startOfDay(day).getTime();
      const matchesDoctor = selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
      const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
      const matchesSearch = !searchQuery ||
        apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDay && matchesDoctor && matchesStatus && matchesSearch;
    });
  };

  const activeAppointment = activeId ? appointments.find(a => a.id === activeId) : null;

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-sm">
        {/* Days header */}
        <div className="grid grid-cols-7 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "p-3 text-center border-r last:border-r-0 border-neutral-200 dark:border-neutral-700",
                isToday(day) && "bg-primary/5"
              )}
            >
              <div className="text-xs font-medium text-muted-foreground uppercase">
                {format(day, "EEE", { locale: ru })}
              </div>
              <div className={cn(
                "text-2xl font-bold mt-1",
                isToday(day) ? "text-primary" : "text-foreground"
              )}>
                {format(day, "d")}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(day, "MMM", { locale: ru })}
              </div>
            </div>
          ))}
        </div>

        {/* Appointments grid */}
        <div className="grid grid-cols-7 min-h-[500px]">
          {days.map((day, dayIndex) => (
            <DroppableTimeSlot
              key={day.toISOString()}
              id={`${dayIndex}-slot`}
              className={cn(
                "border-r last:border-r-0 border-neutral-100 dark:border-neutral-700 p-2 space-y-2",
                isToday(day) && "bg-primary/5"
              )}
            >
              {getAppointmentsForDay(day).map((apt) => (
                <DraggableAppointmentCard
                  key={apt.id}
                  appointment={apt}
                  onUpdate={loadAppointments}
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setIsModalOpen(true);
                  }}
                  compact
                />
              ))}
              {getAppointmentsForDay(day).length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Нет записей
                </div>
              )}
            </DroppableTimeSlot>
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeAppointment && (
          <div className="opacity-80">
            <DraggableAppointmentCard
              appointment={activeAppointment}
              onUpdate={() => {}}
              compact
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
