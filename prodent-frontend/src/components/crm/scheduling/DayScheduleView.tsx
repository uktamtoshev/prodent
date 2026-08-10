import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { format, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  pointerWithin,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import {
  AppointmentData,
  AppointmentStatus,
  appointmentMatchesStatus,
  getAppointmentHour,
} from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { placeAppointment } from "@/lib/appointment-api";

const AppointmentModal = lazy(() =>
  import("../calendar/AppointmentModal").then((module) => ({
    default: module.AppointmentModal,
  })),
);

interface Doctor {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  };
}

interface DayScheduleViewProps {
  selectedDate: Date;
  searchQuery: string;
  selectedDoctor: string;
  selectedStatus: string;
}

export const DayScheduleView = ({
  selectedDate,
  searchQuery,
  selectedDoctor,
  selectedStatus,
}: DayScheduleViewProps) => {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00
  const currentHour = new Date().getHours();

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && currentHour >= 8 && currentHour <= 20) {
      const hourIndex = currentHour - 8;
      const rowHeight = 100; // Approximate height per hour row
      scrollRef.current.scrollTop = Math.max(0, hourIndex * rowHeight - 100);
    }
  }, [currentHour, loading]);

  const loadDoctors = useCallback(async () => {
    try {
      const data = await fetchClinicDoctors(currentClinic!.id);
      setDoctors(data as Doctor[]);
    } catch (error) {
      console.error("Error loading doctors:", error);
    }
  }, [currentClinic]);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const startOfDayDate = startOfDay(selectedDate);
      const endOfDayDate = addHours(startOfDayDate, 24);

      const { data: personalPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic!.id)
        .eq("role", "patient")
        .not("assigned_doctor_id", "is", null);

      const personalPatientIds = new Set(
        personalPatients?.map((p) => p.user_id) || [],
      );

      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id,
          appointment_date,
          start_time,
          room_id,
          service,
          status,
          notes,
          doctor_id,
          patient_id,
          guest_patient_id,
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
        .gte("appointment_date", startOfDayDate.toISOString())
        .lt("appointment_date", endOfDayDate.toISOString())
        .order("appointment_date");

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
  }, [currentClinic, selectedDate]);

  useEffect(() => {
    if (currentClinic) {
      loadDoctors();
      loadAppointments();
    }
  }, [currentClinic, loadAppointments, loadDoctors]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const [doctorId, hourStr] = (over.id as string).split("-");
    const hour = parseInt(hourStr);

    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return;

    const newDate = setMinutes(setHours(new Date(selectedDate), hour), 0);

    try {
      await placeAppointment({
        appointmentId,
        doctorId,
        roomId: appointment.room_id ?? null,
        appointmentDate: format(newDate, "yyyy-MM-dd"),
        startTime: format(newDate, "HH:mm"),
      });

      toast.success(t("crmDayView.apptMoved"));
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error(t("crmDayView.moveApptError"));
    }
  };

  const filteredDoctors =
    selectedDoctor === "all"
      ? doctors
      : doctors.filter((d) => d.id === selectedDoctor);

  const getFilteredAppointments = (doctorId: string, hour: number) => {
    return appointments.filter((apt) => {
      const matchesDoctor = apt.doctor_id === doctorId;
      const matchesHour = getAppointmentHour(apt) === hour;
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
      return matchesDoctor && matchesHour && matchesStatus && matchesSearch;
    });
  };

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return (
      startOfDay(selectedDate).getTime() === startOfDay(now).getTime() &&
      hour === currentHour
    );
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
          <div className="min-w-[720px]">
            {/* Header with doctors */}
            <div
              className="sticky top-0 z-10 grid border-b border-border/60 bg-muted/80 backdrop-blur-sm"
              style={{
                gridTemplateColumns: `80px repeat(${filteredDoctors.length || 1}, minmax(180px, 1fr))`,
              }}
            >
              <div className="p-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("crmDayView.time")}
              </div>
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="border-l border-border/60 p-3 text-center text-sm font-semibold"
                  >
                    {doctor.profiles?.full_name ||
                      t("crmDayView.doctorFallback")}
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-sm font-medium text-muted-foreground">
                  {t("crmDayView.allDoctors")}
                </div>
              )}
            </div>

            {/* Time slots */}
            <div ref={scrollRef} className="max-h-[calc(100vh-350px)] overflow-y-auto bg-background/30">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    "grid border-t border-border/40 transition-colors",
                    isCurrentHour(hour) && "bg-primary/5",
                  )}
                  style={{
                    gridTemplateColumns: `80px repeat(${filteredDoctors.length || 1}, minmax(180px, 1fr))`,
                  }}
                >
                  <div
                    className={cn(
                      "bg-card/45 p-3 text-sm font-medium",
                      isCurrentHour(hour)
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {`${hour}:00`}
                  </div>
                  {filteredDoctors.length > 0 ? (
                    filteredDoctors.map((doctor) => (
                      <DroppableTimeSlot
                        key={`${doctor.id}-${hour}`}
                        id={`${doctor.id}-${hour}`}
                        className="min-h-[104px] border-l border-border/40 p-1.5 transition-colors hover:bg-muted/30"
                      >
                        {getFilteredAppointments(doctor.id, hour).map((apt) => (
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
                    ))
                  ) : (
                    <div className="flex min-h-[104px] items-center justify-center border-l border-border/40 p-2 text-center text-sm text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
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
