import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X, Clock, Loader2, ChevronDown } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { useRespondToAccess, getReasonLabel } from "@/hooks/useMedicalAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PatientAccessRequestMessageProps {
  request: {
    id: string;
    reason: string;
    valid_to: string;
    status: string;
    created_at: string;
  };
  requesterName: string;
}

const DURATION_OPTIONS = [
  { label: "1 час", hours: 1 },
  { label: "6 часов", hours: 6 },
  { label: "24 часа", hours: 24 },
  { label: "3 дня", hours: 72 },
  { label: "7 дней", hours: 168 },
];

export function PatientAccessRequestMessage({ 
  request, 
  requesterName 
}: PatientAccessRequestMessageProps) {
  const respondToAccess = useRespondToAccess();
  const isPending = request.status === 'pending';
  const isActive = request.status === 'active';
  
  // Calculate requested duration in hours
  const requestedDuration = Math.round(
    (new Date(request.valid_to).getTime() - Date.now()) / (1000 * 60 * 60)
  );
  
  const [selectedDuration, setSelectedDuration] = useState<number>(
    requestedDuration > 0 ? requestedDuration : 24
  );

  const handleApprove = (durationHours?: number) => {
    respondToAccess.mutate({ 
      requestId: request.id, 
      approve: true,
      customDurationHours: durationHours
    });
  };

  const handleReject = () => {
    respondToAccess.mutate({ requestId: request.id, approve: false });
  };

  const durationText = formatDistanceToNow(new Date(request.valid_to), { 
    locale: ru 
  });

  const getSelectedLabel = () => {
    const option = DURATION_OPTIONS.find(o => o.hours === selectedDuration);
    return option?.label || `${selectedDuration} ч.`;
  };

  if (isActive) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 max-w-sm">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Shield className="h-4 w-4" />
            <span>Доступ к медкарте предоставлен</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            До {format(new Date(request.valid_to), "d MMMM, HH:mm", { locale: ru })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isPending) {
    return (
      <Card className="border-border/50 bg-muted/30 max-w-sm opacity-75">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Запрос на доступ к медкарте</span>
          </div>
          <Badge variant="secondary" className="mt-2 text-xs">
            {request.status === 'revoked' ? 'Отклонён' : 'Истёк'}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 max-w-sm">
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Запрос доступа к медкарте</p>
            <p className="text-xs text-muted-foreground">от {requesterName}</p>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Причина:</span>
            <span>{getReasonLabel(request.reason)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Срок:</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-sm">
                  <Clock className="h-3 w-3 mr-1" />
                  {getSelectedLabel()}
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {DURATION_OPTIONS.map(option => (
                  <DropdownMenuItem 
                    key={option.hours}
                    onClick={() => setSelectedDuration(option.hours)}
                    className={selectedDuration === option.hours ? "bg-accent" : ""}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={handleReject}
            disabled={respondToAccess.isPending}
          >
            {respondToAccess.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <X className="h-4 w-4 mr-1" />
                Отклонить
              </>
            )}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={() => handleApprove(selectedDuration)}
            disabled={respondToAccess.isPending}
          >
            {respondToAccess.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Одобрить
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
