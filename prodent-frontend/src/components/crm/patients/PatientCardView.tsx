import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar, Phone, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PatientTagBadge } from "./PatientTagBadge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Patient {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string | null;
  patient_tags?: { tag: string }[];
  patientType?: "clinic" | "personal";
}

interface PatientCardViewProps {
  patients: Patient[];
}

const safeLabel = (value: string, fallback: string) =>
  value && !/[\u00c3\u00d0\u00d1\u00c2\u00e2]/.test(value) ? value : fallback;

export function PatientCardView({ patients }: PatientCardViewProps) {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);

  const getInitials = (name: string | null) => {
    if (!name) return "П";
    const parts = name.split(" ");
    return parts
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {patients.map((patient) => {
        const isPersonal = patient.patientType === "personal";

        return (
          <Link key={patient.id} to={`/crm/patients/${patient.id}`}>
            <Card
              className={cn(
                "group relative overflow-hidden rounded-2xl border-border/50 bg-card/90 transition-all duration-200",
                "hover:border-primary/30 hover:shadow-soft",
              )}
            >
              {isPersonal && (
                <div className="absolute right-3 top-3">
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-xs text-amber-600 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  >
                    <UserCheck className="mr-0.5 h-2.5 w-2.5" />
                    {tr("crmPatientTable.personal", "Личный")}
                  </Badge>
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 border-2 border-border/60 transition-colors group-hover:border-primary">
                    <AvatarImage src={patient.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                      {getInitials(patient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                      {patient.full_name || tr("crmPatientTable.noName", "Без имени")}
                    </h3>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="truncate">
                        {patient.phone || "Нет телефона"}
                      </span>
                    </div>
                  </div>
                </div>

                {patient.patient_tags && patient.patient_tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {patient.patient_tags.slice(0, 4).map((tagObj, i) => (
                      <PatientTagBadge key={i} tag={tagObj.tag} size="sm" />
                    ))}
                    {patient.patient_tags.length > 4 && (
                      <Badge
                        variant="outline"
                        className="bg-muted px-1.5 py-0 text-xs"
                      >
                        +{patient.patient_tags.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {patient.created_at && (
                  <div className="mt-4 flex items-center gap-1.5 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {tr("crmPatientTable.added", "Добавлен")}{" "}
                      {format(new Date(patient.created_at), "d MMMM yyyy", {
                        locale: ru,
                      })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
