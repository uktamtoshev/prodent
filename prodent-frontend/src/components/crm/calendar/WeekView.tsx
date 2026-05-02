import { useState, useEffect } from "react";
import { format, startOfWeek, addDays, endOfWeek, startOfDay, addHours, setHours, setMinutes } from "date-fns";
import { ru } from "date-fns/locale";
import { DndContext, DragEndEvent, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
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
import { AppointmentData, APPOINTMENT_STATUSES } from "./appointmentConstants";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Doctor {
  id: string;
  user_id: string;
  profiles: {
    full_name: string;
  };
}

export const WeekView = ({ selectedDate, onDateChange }: WeekViewProps) => {
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    if (currentClinic) {
      loadDoctors();
      loadAppointments();
    }
  }, [currentClinic, selectedDate]);

  const loadDoctors = async () => {
    try {
      const data = await fetchClinicDoctors(currentClinic!.id);
      setDoctors(data as any[]);
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error("Ошибка загрузки врачей");
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const weekEnd = endOfWeek(selectedDate, { locale: ru, weekStartsOn: 1 });

      // First get personal patient IDs
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
          price,
          profiles:patient_id (
            full_name,
            phone
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
      
      // Mark appointments with personal patients
      const appointmentsWithType = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id) || 
          (apt.doctors as any)?.cooperation_type === 'chair_rental'
      }));
      
      setAppointments(appointmentsWithType);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error("Ошибка загрузки записей");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const appointmentId = active.id as string;
    const [dayIndex, doctorId] = (over.id as string).split("-");
    const targetDay = days[parseInt(dayIndex)];

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) return;

    const originalTime = new Date(appointment.appointment_date);
    const newDate = setMinutes(setHours(targetDay, originalTime.getHours()), originalTime.getMinutes());

    try {
      // Check availability
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId || appointment.doctor_id)
        .eq("clinic_id", currentClinic!.id)
        .neq("id", appointmentId)
        .neq("status", "cancelled")
        .eq("appointment_date", newDate.toISOString());

      if (conflicts && conflicts.length > 0) {
        toast.error("Слот уже занят");
        return;
      }

      const updateData: Record<string, any> = {
        appointment_date: newDate.toISOString(),
      };
      if (doctorId && doctorId !== "null") {
        updateData.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (error) throw error;

      toast.success("Запись перенесена");
      loadAppointments();
    } catch (error) {
      console.error("Error moving appointment:", error);
      toast.error("Ошибка переноса записи");
    }
  };

  const goToPreviousWeek = () => {
    const newDate = addDays(selectedDate, -7);
    onDateChange(newDate);
  };

  const goToNextWeek = () => {
    const newDate = addDays(selectedDate, 7);
    onDateChange(newDate);
  };

  const goToCurrentWeek = () => {
    onDateChange(new Date());
  };

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.appointment_date);
      const matchesDay = startOfDay(aptDate).getTime() === startOfDay(day).getTime();
      const matchesDoctor = selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
      const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
      return matchesDay && matchesDoctor && matchesStatus;
    });
  };

  const isToday = (day: Date) => {
    const today = new Date();
    return startOfDay(day).getTime() === startOfDay(today).getTime();
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
            <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
              Текущая неделя
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Все врачи" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все врачи</SelectItem>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.profiles?.full_name || "Врач"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
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
          <div className="grid grid-cols-7 bg-muted/50">
            {days.map((day, index) => (
              <div 
                key={day.toISOString()} 
                className={cn(
                  "p-3 border-r text-center",
                  isToday(day) && "bg-primary/10"
                )}
              >
                <div className="font-medium text-sm">{format(day, "EEE", { locale: ru })}</div>
                <div className={cn(
                  "text-2xl font-bold",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, "d")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(day, "MMM", { locale: ru })}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 min-h-[500px]">
            {days.map((day, dayIndex) => (
              <DroppableTimeSlot 
                key={day.toISOString()} 
                id={`${dayIndex}-${selectedDoctor === "all" ? "null" : selectedDoctor}`}
                className={cn(
                  "border-r p-2 space-y-2",
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
              </DroppableTimeSlot>
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
