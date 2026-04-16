import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  CheckCircle2, 
  Camera, 
  Stethoscope,
  Wrench,
  Eye,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToothTimelineProps {
  patientId: string;
  toothNumber: number;
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  caries: AlertCircle,
  filling: Wrench,
  crown: CheckCircle2,
  implant: CheckCircle2,
  endo: Stethoscope,
  photo: Camera,
  checkup: Eye,
  default: History,
};

const STATUS_COLORS: Record<string, string> = {
  caries: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  filling: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  crown: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30',
  implant: 'text-slate-600 bg-slate-500/10 border-slate-500/30',
  endo: 'text-red-500 bg-red-500/10 border-red-500/30',
  healthy: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
  watch: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  removed: 'text-gray-500 bg-gray-500/10 border-gray-500/30',
  periodontitis: 'text-red-600 bg-red-600/10 border-red-600/30',
  default: 'text-primary bg-primary/10 border-primary/30',
};

const STATUS_LABELS: Record<string, string> = {
  healthy: 'Здоровый',
  caries: 'Кариес',
  filling: 'Пломба',
  crown: 'Коронка',
  implant: 'Имплант',
  removed: 'Удалён',
  watch: 'Наблюдение',
  endo: 'Эндодонтия',
  periodontitis: 'Периодонтит',
};

export function ToothTimeline({ patientId, toothNumber }: ToothTimelineProps) {
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['tooth-history', patientId, toothNumber],
    queryFn: async () => {
      const { data } = await supabase
        .from('tooth_history')
        .select(`
          *,
          doctors:doctor_id(
            user_id,
            profiles:user_id(full_name)
          ),
          clinics:clinic_id(name)
        `)
        .eq('patient_id', patientId)
        .eq('tooth_number', toothNumber)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!patientId && !!toothNumber,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">История изменений</span>
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="w-40 h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!historyData || historyData.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">История изменений</span>
        </div>
        <div className="text-center py-6 text-muted-foreground bg-muted/30 rounded-lg">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Нет записей в истории</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">История изменений</span>
        <Badge variant="outline" className="text-xs">{historyData.length}</Badge>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {historyData.map((event, index) => {
            const Icon = STATUS_ICONS[event.status_after] || STATUS_ICONS.default;
            const colorClass = STATUS_COLORS[event.status_after] || STATUS_COLORS.default;
            const doctorName = event.doctors?.profiles?.full_name;
            const clinicName = event.clinics?.name;

            return (
              <div
                key={event.id}
                className={cn(
                  "relative min-w-[180px] p-3 rounded-xl border bg-card",
                  "hover:shadow-md transition-shadow duration-200"
                )}
              >
                {/* Timeline connector */}
                {index < historyData.length - 1 && (
                  <div className="absolute top-1/2 -right-3 w-3 h-0.5 bg-border" />
                )}

                {/* Icon badge */}
                <div className={cn(
                  "w-8 h-8 rounded-full border flex items-center justify-center mb-2",
                  colorClass
                )}>
                  <Icon className="h-4 w-4" />
                </div>

                {/* Date */}
                <p className="text-xs text-muted-foreground mb-1">
                  {format(new Date(event.created_at), 'd MMM yyyy', { locale: ru })}
                </p>

                {/* Status change */}
                <div className="space-y-1">
                  {event.status_before && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">
                        {STATUS_LABELS[event.status_before] || event.status_before}
                      </span>
                      <span className="text-muted-foreground">→</span>
                    </div>
                  )}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs font-medium", colorClass)}
                  >
                    {STATUS_LABELS[event.status_after] || event.status_after}
                  </Badge>
                </div>

                {/* Procedure name */}
                {event.procedure_name && (
                  <p className="text-xs font-medium mt-2 line-clamp-1">
                    {event.procedure_name}
                  </p>
                )}

                {/* Doctor/Clinic */}
                {(doctorName || clinicName) && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {doctorName || clinicName}
                  </p>
                )}

                {/* Images indicator */}
                {event.images && event.images.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Camera className="h-3 w-3" />
                    <span>{event.images.length} фото</span>
                  </div>
                )}

                {/* Notes preview */}
                {event.notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                    "{event.notes}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
