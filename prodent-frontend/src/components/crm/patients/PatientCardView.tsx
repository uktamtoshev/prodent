import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Phone, Calendar, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PatientTagBadge } from "./PatientTagBadge";
import { cn } from "@/lib/utils";

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

export function PatientCardView({ patients }: PatientCardViewProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "П";
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {patients.map((patient) => {
        const isPersonal = patient.patientType === "personal";

        return (
          <Link key={patient.id} to={`/crm/patients/${patient.id}`}>
            <Card className={cn(
              "relative overflow-hidden transition-all duration-200 cursor-pointer",
              "border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800",
              "hover:shadow-lg hover:border-neutral-300 dark:hover:border-neutral-600",
              "group"
            )}>
              {isPersonal && (
                <div className="absolute top-3 right-3">
                  <Badge 
                    variant="outline" 
                    className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[10px]"
                  >
                    <UserCheck className="w-2.5 h-2.5 mr-0.5" />
                    Личный
                  </Badge>
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className={cn(
                    "w-14 h-14 border-2 transition-colors",
                    "border-neutral-200 dark:border-neutral-600",
                    "group-hover:border-primary"
                  )}>
                    <AvatarImage src={patient.avatar_url || undefined} />
                    <AvatarFallback className="bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-semibold text-lg">
                      {getInitials(patient.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "text-foreground font-semibold truncate",
                      "group-hover:text-primary transition-colors"
                    )}>
                      {patient.full_name || "Без имени"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{patient.phone || "Нет телефона"}</span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {patient.patient_tags && patient.patient_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {patient.patient_tags.slice(0, 4).map((tagObj, i) => (
                      <PatientTagBadge key={i} tag={tagObj.tag} size="sm" />
                    ))}
                    {patient.patient_tags.length > 4 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-neutral-100 dark:bg-neutral-700">
                        +{patient.patient_tags.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Registration date */}
                {patient.created_at && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-700">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Добавлен {format(new Date(patient.created_at), "d MMMM yyyy", { locale: ru })}
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
