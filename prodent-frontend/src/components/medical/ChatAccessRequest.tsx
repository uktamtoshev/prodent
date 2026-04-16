import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, Clock, Send, Loader2, CheckCircle, X } from "lucide-react";
import { useRequestMedicalAccess, useMedicalAccess, AccessDuration } from "@/hooks/useMedicalAccess";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ChatAccessRequestProps {
  patientId: string;
  doctorId?: string;
  clinicId?: string;
}

const DURATIONS: { value: AccessDuration; hours: number; label: string }[] = [
  { value: '24h', hours: 24, label: '24 часа' },
  { value: '72h', hours: 72, label: '3 дня' },
  { value: '7d', hours: 168, label: '7 дней' },
];

export function ChatAccessRequest({ patientId, doctorId, clinicId }: ChatAccessRequestProps) {
  const [duration, setDuration] = useState<AccessDuration>('24h');
  const [showForm, setShowForm] = useState(false);
  
  const requestAccess = useRequestMedicalAccess();
  const { data: accessData, isLoading } = useMedicalAccess(patientId, doctorId, clinicId);

  const handleSubmit = async () => {
    const durationHours = DURATIONS.find(d => d.value === duration)?.hours || 24;

    await requestAccess.mutateAsync({
      patientId,
      doctorId,
      clinicId,
      source: 'chat',
      reason: 'Консультация',
      durationHours
    });

    setShowForm(false);
  };

  if (isLoading) {
    return null;
  }

  // Already has access
  if (accessData?.hasAccess) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 mx-4 my-2">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700 dark:text-emerald-400">
                Доступ к медкарте активен
              </span>
            </div>
            {accessData.expiresAt && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatDistanceToNow(accessData.expiresAt, { locale: ru, addSuffix: true })}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showForm) {
    return (
      <div className="flex justify-center py-2 px-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="gap-2"
        >
          <Shield className="h-4 w-4" />
          Запросить доступ к медкарте
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 mx-4 my-2">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <span className="text-sm">Запрос на</span>
            <Select value={duration} onValueChange={(v) => setDuration(v as AccessDuration)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={requestAccess.isPending}
            >
              {requestAccess.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
