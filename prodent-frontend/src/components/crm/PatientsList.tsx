import { useState, useEffect } from "react";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInYears } from "date-fns";
import { ru } from "date-fns/locale";
import { PatientTags } from "./PatientTags";
import { useQuery } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";

interface PatientsListProps {
  searchTerm: string;
  genderFilter: string;
  statusFilter: string;
  onPatientSelect: (patientId: string) => void;
}

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  gender: string | null;
  birth_date: string | null;
  created_at: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_archived: boolean | null;
  isPersonalPatient?: boolean;
}

export const PatientsList = ({
  searchTerm,
  genderFilter,
  statusFilter,
  onPatientSelect,
}: PatientsListProps) => {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { isDoctor, isSuperAdmin, isClinicAdmin, isClinicManager } = useUserRole();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Получаем информацию о текущем враче
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor-list", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("doctors")
        .select("id, cooperation_type")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && isDoctor,
  });

  const isChairRental = currentDoctor?.cooperation_type === "chair_rental";
  const canViewAllPatients = isSuperAdmin || isClinicAdmin || isClinicManager;

  // Загрузка пациентов с учётом типа сотрудничества врача
  const { data: patients = [], isLoading: loading } = useQuery({
    queryKey: ["patients-list", currentClinic?.id, currentDoctor?.id, searchTerm, genderFilter, statusFilter, page],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      let patientIds: string[] = [];
      let personalPatientIds: string[] = [];

      // Если арендатор и не супер-админ - получаем только его пациентов
      if (isChairRental && !canViewAllPatients && currentDoctor?.id) {
        const { data: members } = await supabase
          .from("clinic_members")
          .select("user_id")
          .eq("clinic_id", currentClinic.id)
          .eq("role", "patient")
          .eq("assigned_doctor_id", currentDoctor.id);
          
        if (!members || members.length === 0) return [];
        patientIds = members.map(m => m.user_id);
      } else {
        // Для штатных врачей и админов - получаем пациентов клиники
        const { data: clinicMembers } = await supabase
          .from("clinic_members")
          .select("user_id, assigned_doctor_id")
          .eq("clinic_id", currentClinic.id)
          .eq("role", "patient")
          .is("assigned_doctor_id", null);

        patientIds = (clinicMembers || []).map(m => m.user_id);
        
        // Для супер-админа также показываем личных пациентов врачей
        if (isSuperAdmin) {
          const { data: personalMembers } = await supabase
            .from("clinic_members")
            .select("user_id")
            .eq("clinic_id", currentClinic.id)
            .eq("role", "patient")
            .not("assigned_doctor_id", "is", null);
            
          personalPatientIds = (personalMembers || []).map(m => m.user_id);
        }
      }

      if (patientIds.length === 0 && personalPatientIds.length === 0) return [];

      const allIds = [...new Set([...patientIds, ...personalPatientIds])];

      let query = supabase
        .from("profiles")
        .select("id, full_name, phone, gender, birth_date, email, address, notes, is_archived, created_at")
        .in("id", allIds)
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = data || [];

      if (genderFilter !== "all") {
        filtered = filtered.filter((p: any) => p.gender === genderFilter);
      }

      if (statusFilter !== "all") {
        filtered = filtered.filter((p: any) =>
          statusFilter === "active" ? !p.is_archived : p.is_archived
        );
      }

      // Отмечаем личных пациентов
      return filtered.map(p => ({
        ...p,
        isPersonalPatient: personalPatientIds.includes(p.id)
      }));
    },
    enabled: !!currentClinic?.id,
  });

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return "—";
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getGenderLabel = (gender: string | null) => {
    return gender === "male" ? "М" : gender === "female" ? "Ж" : "—";
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ФИО</TableHead>
            <TableHead>Телефон</TableHead>
            <TableHead>Пол</TableHead>
            <TableHead>Возраст</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Последний визит</TableHead>
            <TableHead>Всего оплат</TableHead>
            <TableHead>Дата регистрации</TableHead>
            <TableHead>Теги</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => (
            <TableRow
              key={patient.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onPatientSelect(patient.id)}
            >
              <TableCell>{patient.full_name || "—"}</TableCell>
              <TableCell>{patient.phone || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline">{getGenderLabel(patient.gender)}</Badge>
              </TableCell>
              <TableCell>{calculateAge(patient.birth_date)} лет</TableCell>
              <TableCell>
                {patient.isPersonalPatient ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Личный
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    Клиника
                  </Badge>
                )}
              </TableCell>
              <TableCell>—</TableCell>
              <TableCell>—</TableCell>
              <TableCell>
                {format(new Date(patient.created_at), "dd MMM yyyy", { locale: ru })}
              </TableCell>
              <TableCell>
                <PatientTags patientId={patient.id} compact />
              </TableCell>
            </TableRow>
          ))}
          {patients.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                {isChairRental && !canViewAllPatients
                  ? "У вас пока нет личных пациентов"
                  : "Пациенты не найдены"}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
