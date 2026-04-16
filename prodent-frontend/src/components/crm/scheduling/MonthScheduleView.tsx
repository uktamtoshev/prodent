import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { toast } from "sonner";
import { AppointmentModal } from "../calendar/AppointmentModal";
import { AppointmentData, APPOINTMENT_STATUSES, AppointmentStatus } from "../calendar/appointmentConstants";
import { AppointmentListItem } from "./AppointmentListItem";
import { Skeleton } from "@/components/ui/skeleton";

interface MonthScheduleViewProps {
  selectedDate: Date;
  searchQuery: string;
  selectedDoctor: string;
  selectedStatus: string;
}

export const MonthScheduleView = ({
  selectedDate,
  searchQuery,
  selectedDoctor,
  selectedStatus,
}: MonthScheduleViewProps) => {
  const { currentClinic } = useClinic();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (currentClinic) {
      loadAppointments();
    }
  }, [currentClinic, selectedDate]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

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
            cooperation_type,
            profiles:user_id (
              full_name
            )
          )
        `)
        .eq("clinic_id", currentClinic!.id)
        .gte("appointment_date", monthStart.toISOString())
        .lte("appointment_date", monthEnd.toISOString())
        .order("appointment_date");

      if (error) throw error;

      const appointmentData = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id || '') ||
          (apt.doctors as any)?.cooperation_type === 'chair_rental',
        isGuestPatient: !!apt.guest_patient_id
      }));

      setAppointments(appointmentData);
    } catch (error) {
      console.error("Error loading appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (appointmentId: string, newStatus: AppointmentStatus) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", appointmentId);

      if (error) throw error;

      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        const statusLabel = APPOINTMENT_STATUSES[newStatus]?.label || newStatus;
        await supabase.from("notifications").insert({
          user_id: appointment.patient_id,
          type: "internal",
          title: "Изменение статуса записи",
          message: `Статус вашей записи изменён на: ${statusLabel}`,
          metadata: { appointment_id: appointmentId },
        });
      }

      toast.success("Статус обновлён");
      loadAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Ошибка обновления статуса");
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesDoctor = selectedDoctor === "all" || apt.doctor_id === selectedDoctor;
    const matchesStatus = selectedStatus === "all" || apt.status === selectedStatus;
    const matchesSearch = !searchQuery ||
      apt.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.service?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDoctor && matchesStatus && matchesSearch;
  });

  // Group by date
  const groupedByDate = filteredAppointments.reduce((acc, apt) => {
    const dateKey = format(new Date(apt.appointment_date), "yyyy-MM-dd");
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(apt);
    return acc;
  }, {} as Record<string, AppointmentData[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">Записи не найдены</p>
          <p className="text-sm mt-1">Попробуйте изменить фильтры или создайте новую запись</p>
        </div>
      ) : (
        sortedDates.map((dateKey) => {
          const dayAppointments = groupedByDate[dateKey];
          const date = new Date(dateKey);
          const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

          return (
            <div key={dateKey}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className={`text-sm font-semibold uppercase tracking-wide ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {format(date, "d MMMM, EEEE", { locale: ru })}
                </h3>
                {isToday && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                    Сегодня
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {dayAppointments.length} {dayAppointments.length === 1 ? 'запись' : 'записей'}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dayAppointments.map((apt) => (
                  <AppointmentListItem
                    key={apt.id}
                    appointment={apt}
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setIsModalOpen(true);
                    }}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      <AppointmentModal
        appointment={selectedAppointment}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdate={loadAppointments}
      />
    </div>
  );
};
