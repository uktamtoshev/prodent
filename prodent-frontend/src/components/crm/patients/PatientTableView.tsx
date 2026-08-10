import { differenceInYears, format } from "date-fns";
import { ru } from "date-fns/locale";
import { Building2, MoreHorizontal, Phone, UserCheck } from "lucide-react";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { a11yLabel } from "@/lib/a11y-labels";

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

const safeLabel = (value: string, fallback: string) =>
  value && !/[\u00c3\u00d0\u00d1\u00c2\u00e2]/.test(value) ? value : fallback;

export function PatientTableView({ patients }: PatientTableViewProps) {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);

  const getInitials = (name: string | null) => {
    if (!name) return tr("crmPatientTable.initialP", "П");
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const getGenderLabel = (gender: string | null) => {
    if (gender === "male") return tr("crmPatientTable.male", "М");
    if (gender === "female") return tr("crmPatientTable.female", "Ж");
    return "—";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/90 shadow-soft">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">{tr("crmPatientTable.patient", "Пациент")}</TableHead>
            <TableHead className="font-semibold">{tr("crmPatientTable.headerPhone", "Телефон")}</TableHead>
            <TableHead className="w-[80px] font-semibold">{tr("crmPatientTable.gender", "Пол")}</TableHead>
            <TableHead className="w-[100px] font-semibold">{tr("crmPatientTable.age", "Возраст")}</TableHead>
            <TableHead className="w-[120px] font-semibold">{tr("crmPatientTable.type", "Тип")}</TableHead>
            <TableHead className="font-semibold">{tr("crmPatientTable.tags", "Теги")}</TableHead>
            <TableHead className="font-semibold">{tr("crmPatientTable.added", "Добавлен")}</TableHead>
            <TableHead className="w-[60px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {patients.map((patient) => {
            const age = calculateAge(patient.birth_date || null);
            const isPersonal = patient.patientType === "personal";

            return (
              <TableRow key={patient.id} className="group cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link to={`/crm/patients/${patient.id}`} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={patient.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                        {getInitials(patient.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground transition-colors group-hover:text-primary">
                      {patient.full_name || tr("crmPatientTable.noName", "Без имени")}
                    </span>
                  </Link>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
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
                    <span className="text-foreground">
                      {age} {tr("crmPatientTable.yearsOld", "лет")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {isPersonal ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      <UserCheck className="mr-1 h-3 w-3" />
                      {tr("crmPatientTable.personal", "Личный")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                      <Building2 className="mr-1 h-3 w-3" />
                      {tr("crmPatientTable.clinic", "Клиника")}
                    </Badge>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {patient.patient_tags && patient.patient_tags.length > 0 ? (
                      patient.patient_tags.slice(0, 3).map((tagObj, index) => (
                        <PatientTagBadge key={index} tag={tagObj.tag} size="sm" showIcon={false} />
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                    {patient.patient_tags && patient.patient_tags.length > 3 && (
                      <Badge variant="outline" className="px-1.5 py-0 text-xs">
                        +{patient.patient_tags.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {patient.created_at ? format(new Date(patient.created_at), "dd.MM.yyyy", { locale: ru }) : "—"}
                </TableCell>

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" aria-label={a11yLabel("more")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/crm/patients/${patient.id}`}>
                          {tr("crmPatientTable.openProfile", "Открыть профиль")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>{tr("crmPatientTable.createAppt", "Создать запись")}</DropdownMenuItem>
                      <DropdownMenuItem>{tr("crmPatientTable.editTags", "Редактировать теги")}</DropdownMenuItem>
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
