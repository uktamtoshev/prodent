import { useState, useEffect, useRef } from "react";
import { format, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
import { toast } from "sonner";
import { DraggableAppointmentCard } from "../calendar/DraggableAppointmentCard";
import { DroppableTimeSlot } from "../calendar/DroppableTimeSlot";
import { AppointmentModal } from "../calendar/AppointmentModal";
import { AppointmentData, AppointmentStatus } from "../calendar/appointmentConstants";
import { cn } from "@/lib/utils";

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
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00
  const currentHour = new Date().getHours();

  useEffect(() => {
    if (currentClinic) {
      loadDoctors();
      loadAppointments();
    }
  }, [currentClinic, selectedDate]);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && currentHour >= 8 && currentHour <= 20) {
      const hourIndex = currentHour - 8;
      const rowHeight = 100; // Approximate height per hour row
      scrollRef.current.scrollTop = Math.max(0, hourIndex * rowHeight - 100);
    }
  }, [loading]);

  const loadDoctors = async () => {
    try {
      const data = await fetchClinicDoctors(currentClinic!.id);
      setDoctors(data as Doctor[]);
    } catch (error) {
      console.error("Error loading doctors:", error);
    }
  };

  const loadAppointments = async () => {
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

      const personalPatientIds = new Set(personalPatients?.map(p => p.user_id) || []);

      const { data, error } = await supabase
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
        .gte("appointment_date", startOfDayDate.toISOString())
        .lt("appointment_date", endOfDayDate.toISOString())
        .order("appointment_date");

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
    const [doctorId, hourStr] = (over.id as string).split("-");
    const hour = parseInt(hourStr);

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const newDate = setMinutes(setHours(new Date(selectedDate), hour), 0);

    try {
      const { error } = await supabase
        .from("appointments")
        .update({
          doctor_id: doctorId,
          appointment_date: newDate.toISOString(),
        })
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Запись перенесена");
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error("Ошибка переноса записи");
    }
  };

  const filteredDoctors = selectedDoctor === "all"
    ? doctors
    : doctors.filter(d => d.id === selectedDoctor);

  const getFilteredAppointments = (doctorId: string, hour: number) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      const matchesDoctor = apt.doctor_id === doctorId;
      const matchesHour = aptDate.getHours() === hour;
      const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
      const matchesSearch = !searchQuery || 
        apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDoctor && matchesHour && matchesStatus && matchesSearch;
    });
  };

  const isCurrentHour = (hour: number) => {
    const now = new Date();
    return startOfDay(selectedDate).getTime() === startOfDay(now).getTime() && hour === currentHour;
  };

  const activeAppointment = activeId ? appointments.find(a => a.id === activeId) : null;

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id as string)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-sm">
        {/* Header with doctors */}
        <div
          className="grid bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700"
          style={{ gridTemplateColumns: `80px repeat(${filteredDoctors.length || 1}, minmax(180px, 1fr))` }}
        >
          <div className="p-3 font-medium text-xs text-muted-foreground uppercase tracking-wide">
            Время
          </div>
          {filteredDoctors.length > 0 ? (
            filteredDoctors.map((doctor) => (
              <div key={doctor.id} className="p-3 font-medium text-sm text-center border-l border-neutral-200 dark:border-neutral-700">
                {doctor.profiles?.full_name || "Врач"}
              </div>
            ))
          ) : (
            <div className="p-3 font-medium text-sm text-center text-muted-foreground">
              Нет врачей
            </div>
          )}
        </div>

        {/* Time slots */}
        <div ref={scrollRef} className="max-h-[calc(100vh-350px)] overflow-y-auto">
          {hours.map((hour) => (
            <div
              key={hour}
              className={cn(
                "grid border-t border-neutral-100 dark:border-neutral-700",
                isCurrentHour(hour) && "bg-primary/5"
              )}
              style={{ gridTemplateColumns: `80px repeat(${filteredDoctors.length || 1}, minmax(180px, 1fr))` }}
            >
              <div className={cn(
                "p-3 text-sm font-medium",
                isCurrentHour(hour) ? "text-primary" : "text-muted-foreground"
              )}>
                {`${hour}:00`}
              </div>
              {filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <DroppableTimeSlot
                    key={`${doctor.id}-${hour}`}
                    id={`${doctor.id}-${hour}`}
                    className="border-l border-neutral-100 dark:border-neutral-700 min-h-[100px]"
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
                <div className="border-l border-neutral-100 dark:border-neutral-700 min-h-[100px] p-2 text-center text-muted-foreground text-sm flex items-center justify-center">
                  —
                </div>
              )}
            </div>
          ))}
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
