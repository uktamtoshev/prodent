import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { fetchClinicDoctors } from "@/hooks/useClinicDoctors";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MoreHorizontal, UserCheck, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppointmentModal } from "./AppointmentModal";
import { AppointmentData, APPOINTMENT_STATUSES, getStatusStyle, AppointmentStatus } from "./appointmentConstants";

interface MonthViewProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

interface Doctor {
  id: string;
  profiles: {
    full_name: string;
  };
}

export const MonthView = ({ selectedDate, onDateChange }: MonthViewProps) => {
  const { currentClinic } = useClinic();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedService, setSelectedService] = useState<string>("all");
  const [services, setServices] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      // First get personal patient IDs
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
          price,
          profiles:patient_id (
            full_name,
            phone
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
      
      // Mark appointments with personal patients
      const appointmentData = (data || []).map(apt => ({
        ...apt,
        isPersonalPatient: personalPatientIds.has(apt.patient_id) || 
          (apt.doctors as any)?.cooperation_type === 'chair_rental'
      }));
      
      setAppointments(appointmentData);
      
      // Extract unique services
      const uniqueServices = [...new Set(appointmentData.map(a => a.service))];
      setServices(uniqueServices);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error("Ошибка загрузки записей");
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const goToNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const goToCurrentMonth = () => {
    onDateChange(new Date());
  };

  const updateStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus as any })
        .eq("id", appointmentId);

      if (error) throw error;

      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment) {
        const statusLabel = APPOINTMENT_STATUSES[newStatus as AppointmentStatus]?.label || newStatus;
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
    const matchesService = selectedService === "all" || apt.service === selectedService;
    return matchesDoctor && matchesStatus && matchesService;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
            Текущий месяц
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2 capitalize">
            {format(selectedDate, "LLLL yyyy", { locale: ru })}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="w-[160px]">
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
            <SelectTrigger className="w-[160px]">
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
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Все услуги" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все услуги</SelectItem>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата и время</TableHead>
              <TableHead>Пациент</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Врач</TableHead>
              <TableHead>Услуга</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="w-[50px]">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAppointments.map((apt) => {
              const statusStyle = getStatusStyle(apt.status);
              const isPersonal = apt.isPersonalPatient;
              return (
                <TableRow 
                  key={apt.id} 
                  className={`cursor-pointer hover:bg-muted/50 ${isPersonal ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}`}
                  onClick={() => {
                    setSelectedAppointment(apt);
                    setIsModalOpen(true);
                  }}
                >
                  <TableCell className="font-medium">
                    {format(new Date(apt.appointment_date), "d MMM yyyy, HH:mm", { locale: ru })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      {isPersonal && <UserCheck className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                      <div>
                        <div className="font-medium">{apt.profiles?.full_name || "—"}</div>
                        <div className="text-sm text-muted-foreground">{apt.profiles?.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isPersonal ? (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Вне кассы
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        <Building2 className="h-3 w-3 mr-1" />
                        Клиника
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{apt.doctors?.profiles?.full_name || "—"}</TableCell>
                  <TableCell>{apt.service}</TableCell>
                  <TableCell>
                    <Badge 
                      className={`${statusStyle.bgColor} ${statusStyle.color} ${statusStyle.borderColor} border`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {Object.entries(APPOINTMENT_STATUSES)
                          .filter(([key]) => key !== apt.status)
                          .map(([key, value]) => (
                            <DropdownMenuItem
                              key={key}
                              onClick={() => updateStatus(apt.id, key)}
                            >
                              {value.label}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredAppointments.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Записи не найдены
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AppointmentModal
        appointment={selectedAppointment}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onUpdate={loadAppointments}
      />
    </div>
  );
};
