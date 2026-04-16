import { format, differenceInYears } from "date-fns";
import { ru } from "date-fns/locale";
import { Phone, MoreHorizontal, UserCheck, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { PatientTagBadge } from "./PatientTagBadge";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  gender?: string | null;
  birth_date?: string | null;
  patient_tags?: { tag: string }[];
  patientType?: "clinic" | "personal";
}

interface PatientTableViewProps {
  patients: Patient[];
}

export function PatientTableView({ patients }: PatientTableViewProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "П";
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getGenderLabel = (gender: string | null) => {
    return gender === "male" ? "М" : gender === "female" ? "Ж" : "—";
  };

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-neutral-50 dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-900">
            <TableHead className="font-semibold">Пациент</TableHead>
            <TableHead className="font-semibold">Телефон</TableHead>
            <TableHead className="font-semibold w-[80px]">Пол</TableHead>
            <TableHead className="font-semibold w-[100px]">Возраст</TableHead>
            <TableHead className="font-semibold w-[120px]">Тип</TableHead>
            <TableHead className="font-semibold">Теги</TableHead>
            <TableHead className="font-semibold">Добавлен</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const age = calculateAge(patient.birth_date || null);
            const isPersonal = patient.patientType === "personal";

            return (
              <TableRow
                key={patient.id}
                className="group cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
              >
                <TableCell>
                  <Link to={`/crm/patients/${patient.id}`} className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 border border-neutral-200 dark:border-neutral-600">
                      <AvatarImage src={patient.avatar_url || undefined} />
                      <AvatarFallback className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-sm font-medium">
                        {getInitials(patient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {patient.full_name || "Без имени"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    {patient.phone || "—"}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium">
                    {getGenderLabel(patient.gender || null)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {age !== null ? (
                    <span className="text-foreground">{age} лет</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {isPersonal ? (
                    <Badge 
                      variant="outline" 
                      className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                    >
                      <UserCheck className="w-3 h-3 mr-1" />
                      Личный
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-600"
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      Клиника
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {patient.patient_tags && patient.patient_tags.length > 0 ? (
                      patient.patient_tags.slice(0, 3).map((tagObj, i) => (
                        <PatientTagBadge key={i} tag={tagObj.tag} size="sm" showIcon={false} />
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                    {patient.patient_tags && patient.patient_tags.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{patient.patient_tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {patient.created_at 
                    ? format(new Date(patient.created_at), "dd.MM.yyyy", { locale: ru })
                    : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/crm/patients/${patient.id}`}>
                          Открыть профиль
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>Создать запись</DropdownMenuItem>
                      <DropdownMenuItem>Редактировать теги</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
