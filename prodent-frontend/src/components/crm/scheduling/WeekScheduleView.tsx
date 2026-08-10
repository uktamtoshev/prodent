import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from "react";
import {
  format,
  startOfWeek,
  addDays,
  endOfWeek,
  startOfDay,
  addHours,
} from "date-fns";
import { ru } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import {
  AppointmentData,
  appointmentMatchesStatus,
} from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { placeAppointment } from "@/lib/appointment-api";
import { useLanguage } from "@/contexts/LanguageContext";

const AppointmentModal = lazy(() =>
  import("../calendar/AppointmentModal").then((module) => ({
    default: module.AppointmentModal,
  })),
);

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
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 }),
    [selectedDate],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const weekEnd = endOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 });

      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);

      const personalPatientIds = new Set(
        personalPatients?.map((p) => p.user_id) || [],
      );

      const query = supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          start_time,
          end_time,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          guest_patient_id,
          room_id,
          total_price,
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
        `,
        )
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", weekStart.toISOString())
        .lte("appointment_date", addHours(weekEnd, 24).toISOString())
        .order("appointment_date");

      const { data, error } = await query;

      if (error) throw error;

      const appointmentsWithType = (data || []).map((apt) => ({
        ...apt,
        isPersonalPatient:
          personalPatientIds.has(apt.patient_id || "") ||
          apt.doctors?.cooperation_type === "chair_rental",
        isGuestPatient: !!apt.guest_patient_id,
      }));

      setAppointments(appointmentsWithType);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, selectedDate, weekStart]);

  useEffect(() => {
    if (currentClinic) {
      loadAppointments();
    }
  }, [currentClinic, loadAppointments]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const [dayIndex] = (over.id as string).split("-");
    const targetDay = days[parseInt(dayIndex)];

    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    // The DB stores appointment_date as DATE and start_time/end_time as TIME.
    // A drag only changes the DAY; the time-of-day (and thus duration) is preserved.
    const newAppointmentDate = format(targetDay, "yyyy-MM-dd");

    // Prefer the separated TIME columns; fall back to the legacy timestamp value.
    const originalTime = new Date(appointment.appointment_date);
    const startTime = appointment.start_time
      ? appointment.start_time.slice(0, 5)
      : format(originalTime, "HH:mm");

    try {
      await placeAppointment({
        appointmentId,
        roomId: appointment.room_id ?? null,
        appointmentDate: newAppointmentDate,
        startTime,
      });

      toast.success(t("crmDayView.apptMoved"));
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error(t("crmDayView.moveApptError"));
    }
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return startOfDay(day).getTime() === startOfDay(today).getTime();
  };

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      const matchesDay =
        startOfDay(aptDate).getTime() === startOfDay(day).getTime();
      const matchesDoctor =
        selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
      const matchesStatus = appointmentMatchesStatus(
        apt.status,
        selectedStatus,
      );
      const matchesSearch =
        !searchQuery ||
        apt.profiles?.full_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDay && matchesDoctor && matchesStatus && matchesSearch;
    });
  };

  const activeAppointment = activeId
    ? appointments.find((a) => a.id === activeId)
    : null;

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-soft">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            {/* Days header */}
            <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border/60 bg-muted/80 backdrop-blur-sm">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r border-border/60 p-3 text-center last:border-r-0",
                    isToday(day) && "bg-primary/5",
                  )}
                >
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    {format(day, "EEE", { locale: ru })}
                  </div>
                  <div
                    className={cn(
                      "mt-1 text-2xl font-bold",
                      isToday(day) ? "text-primary" : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(day, "MMM", { locale: ru })}
                  </div>
                </div>
              ))}
            </div>

            {/* Appointments grid */}
            <div className="grid min-h-[500px] grid-cols-7 bg-background/30">
              {days.map((day, dayIndex) => (
                <DroppableTimeSlot
                  key={day.toISOString()}
                  id={`${dayIndex}-slot`}
                  className={cn(
                    "space-y-2 border-r border-border/40 p-2.5 transition-colors last:border-r-0 hover:bg-muted/25",
                    isToday(day) && "bg-primary/5",
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
                    <div className="rounded-xl border border-dashed border-border/50 bg-card/50 py-4 text-center text-xs text-muted-foreground">
                      {t("crmWeekView.noAppointments")}
                    </div>
                  )}
                </DroppableTimeSlot>
              ))}
            </div>
          </div>
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

      {isModalOpen && selectedAppointment && (
        <Suspense fallback={null}>
          <AppointmentModal
            appointment={selectedAppointment}
            open={isModalOpen}
            onOpenChange={setIsModalOpen}
            onUpdate={loadAppointments}
          />
        </Suspense>
      )}
    </DndContext>
  );
};
