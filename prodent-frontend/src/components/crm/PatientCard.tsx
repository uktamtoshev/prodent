import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface PatientCardProps {
  patient: {
    id: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    created_at: string | null;
    patient_tags?: { tag: string }[];
  };
}

export function PatientCard({ patient }: PatientCardProps) {
  const getInitials = (name: string | null) => {
    if (!name) return "П";
    const parts = name.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const getTagColor = (tag: string) => {
    const colors: Record<string, string> = {
      VIP: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      Дети: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      Аллергия: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      Долг: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      Постоянный: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      Новый: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    };
    return colors[tag] || "bg-muted text-muted-foreground border-border";
  };

  return (
    <Link to={`/crm/patients/${patient.id}`}>
      <Card className={cn(
        "border-border/50 bg-card/80 backdrop-blur-sm",
        "hover:border-primary/30 hover:shadow-soft",
        "transition-all duration-200 cursor-pointer group"
      )}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className={cn(
              "w-12 h-12 border-2 border-border/50",
              "group-hover:border-primary transition-colors"
            )}>
              <AvatarImage src={patient.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(patient.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className={cn(
                "text-foreground font-semibold mb-1 truncate",
                "group-hover:text-primary transition-colors"
              )}>
                {patient.full_name || "Без имени"}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Phone className="w-3 h-3" />
                <span>{patient.phone || "Нет телефона"}</span>
              </div>
              {patient.patient_tags && patient.patient_tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {patient.patient_tags.map((tagObj, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={cn("text-xs", getTagColor(tagObj.tag))}
                    >
                      {tagObj.tag}
                    </Badge>
                  ))}
                </div>
              )}
              {patient.created_at && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground/70 mt-2">
                  <Calendar className="w-3 h-3" />
                  <span>
                    С {format(new Date(patient.created_at), "dd.MM.yyyy", { locale: ru })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
