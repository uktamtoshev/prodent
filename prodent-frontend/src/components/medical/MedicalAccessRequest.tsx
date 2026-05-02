import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  FileHeart, 
  Send, 
  Check, 
  X,
  Clock,
  ShieldCheck,
  Eye,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestMedicalAccessProps {
  doctorId: string;
  patientId: string;
  patientName: string;
}

export function RequestMedicalAccessButton({ doctorId, patientId, patientName }: RequestMedicalAccessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const queryClient = useQueryClient();

  // Проверяем статус текущего запроса
  const { data: existingRequest } = useQuery({
    queryKey: ['medical-access-request', doctorId, patientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_access_requests')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const requestAccessMutation = useMutation({
    mutationFn: async () => {
      // Создаём запрос на доступ с согласием врача
      const { error } = await supabase
        .from('medical_access_requests')
        .insert({
          doctor_id: doctorId,
          patient_id: patientId,
          request_type: 'full',
          message: message || 'Врач запрашивает доступ к вашей медицинской карте для просмотра истории лечения.',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 дней
          doctor_consent: true,
          doctor_consent_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Создаём уведомление для пациента
      await supabase.from('notifications').insert({
        user_id: patientId,
        title: 'Запрос доступа к медкарте',
        message: `Врач запрашивает доступ к вашей медицинской карте`,
        type: 'medical_access_request',
        metadata: { link: '/patient/messages' },
      });
    },
    onSuccess: () => {
      toast.success('Запрос отправлен');
      setIsOpen(false);
      setMessage('');
      setConsentGiven(false);
      queryClient.invalidateQueries({ queryKey: ['medical-access-request', doctorId, patientId] });
    },
    onError: () => {
      toast.error('Ошибка отправки запроса');
    },
  });

  // Если уже есть одобренный доступ
  if (existingRequest?.status === 'approved') {
    return (
      <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30">
        <ShieldCheck className="h-3.5 w-3.5" />
        Доступ открыт
      </Badge>
    );
  }

  // Если запрос ожидает ответа
  if (existingRequest?.status === 'pending') {
    return (
      <Badge variant="outline" className="gap-1.5 text-amber-600 border-amber-500/30 bg-amber-50 dark:bg-amber-950/30">
        <Clock className="h-3.5 w-3.5" />
        Ожидает ответа
      </Badge>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <FileHeart className="h-4 w-4" />
        Запросить медкарту
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setConsentGiven(false);
          setMessage('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileHeart className="h-5 w-5 text-primary" />
              Запрос доступа к медкарте
            </DialogTitle>
            <DialogDescription>
              Запросите у пациента {patientName} доступ для просмотра медицинской карты, 
              зубной формулы и файлов.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Сообщение для пациента (опционально)</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Укажите причину запроса..."
                rows={3}
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p>После одобрения вы получите доступ к:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>Зубная формула и история изменений</li>
                <li>Рентген снимки и фотографии</li>
                <li>Планы лечения и рекомендации</li>
              </ul>
            </div>

            {/* Согласие врача на обработку персональных данных */}
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Согласие на обработку персональных данных</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Для получения доступа к медкарте необходимо подтвердить согласие
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Checkbox 
                  id="doctor-consent" 
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked === true)}
                />
                <Label htmlFor="doctor-consent" className="text-sm leading-relaxed cursor-pointer">
                  Я обязуюсь обеспечить конфиденциальность и защиту персональных данных пациента 
                  в соответствии с законодательством Республики Узбекистан о персональных данных. 
                  Полученная информация будет использована исключительно в медицинских целях.
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Отмена
            </Button>
            <Button 
              onClick={() => requestAccessMutation.mutate()}
              disabled={requestAccessMutation.isPending || !consentGiven}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Отправить запрос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Компонент для отображения запроса в чате пациента
interface AccessRequestMessageProps {
  request: {
    id: string;
    doctor_id: string;
    status: string;
    message: string | null;
    created_at: string;
    doctor_consent?: boolean;
  };
  doctorName: string;
  onRespond: (requestId: string, approved: boolean) => void;
  isLoading?: boolean;
}

export function AccessRequestMessage({ request, doctorName, onRespond, isLoading }: AccessRequestMessageProps) {
  const [consentGiven, setConsentGiven] = useState(false);

  if (request.status !== 'pending') {
    return (
      <div className={cn(
        "p-4 rounded-xl border max-w-md mx-auto my-4",
        request.status === 'approved' 
          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30"
          : "bg-red-50 dark:bg-red-950/30 border-red-500/30"
      )}>
        <div className="flex items-center gap-2 mb-2">
          {request.status === 'approved' ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <X className="h-5 w-5 text-red-600" />
          )}
          <span className="font-medium">
            {request.status === 'approved' ? 'Доступ разрешён' : 'Доступ отклонён'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Вы {request.status === 'approved' ? 'предоставили' : 'отклонили'} доступ врачу {doctorName} к вашей медкарте
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 max-w-md mx-auto my-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-full bg-primary/10">
          <FileHeart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">Запрос доступа к медкарте</p>
          <p className="text-xs text-muted-foreground">от {doctorName}</p>
        </div>
      </div>

      {request.message && (
        <p className="text-sm text-muted-foreground mb-4 italic">
          "{request.message}"
        </p>
      )}

      <div className="space-y-2 mb-4 text-sm">
        <p className="font-medium">Врач получит доступ к:</p>
        <ul className="space-y-1 text-muted-foreground">
          <li className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            Зубная формула и состояние зубов
          </li>
          <li className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            Рентген снимки и фотографии
          </li>
          <li className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" />
            История лечения
          </li>
        </ul>
      </div>

      {/* Информация о согласии врача */}
      {request.doctor_consent && (
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 mb-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Врач подтвердил обязательство защиты ваших данных
          </p>
        </div>
      )}

      {/* Согласие пациента на передачу данных */}
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 mb-4 space-y-2">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5" />
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Согласие на передачу персональных данных
          </p>
        </div>
        <div className="flex items-start space-x-2">
          <Checkbox 
            id="patient-consent" 
            checked={consentGiven}
            onCheckedChange={(checked) => setConsentGiven(checked === true)}
          />
          <Label htmlFor="patient-consent" className="text-xs leading-relaxed cursor-pointer text-muted-foreground">
            Я согласен на передачу моих персональных медицинских данных указанному врачу 
            для оказания медицинских услуг
          </Label>
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onRespond(request.id, false)}
          disabled={isLoading}
          className="flex-1 gap-1"
        >
          <X className="h-4 w-4" />
          Отклонить
        </Button>
        <Button 
          size="sm"
          onClick={() => onRespond(request.id, true)}
          disabled={isLoading || !consentGiven}
          className="flex-1 gap-1"
        >
          <Check className="h-4 w-4" />
          Разрешить
        </Button>
      </div>
    </div>
  );
}

// Хук для проверки доступа врача к медкарте пациента
export function useMedicalAccess(doctorId: string | undefined, patientId: string | undefined) {
  return useQuery({
    queryKey: ['medical-access', doctorId, patientId],
    queryFn: async () => {
      if (!doctorId || !patientId) return { hasAccess: false, request: null };
      
      const { data } = await supabase
        .from('medical_access_requests')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('patient_id', patientId)
        .eq('status', 'approved')
        .eq('doctor_consent', true)
        .eq('patient_consent', true) // Обе стороны должны дать согласие
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();
      
      return { hasAccess: !!data, request: data };
    },
    enabled: !!doctorId && !!patientId,
  });
}

// Функция для обновления согласия пациента
export async function updatePatientConsent(requestId: string, approved: boolean) {
  if (approved) {
    const { error } = await supabase
      .from('medical_access_requests')
      .update({
        status: 'approved',
        patient_consent: true,
        patient_consent_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('medical_access_requests')
      .update({
        status: 'rejected',
        patient_consent: false,
      })
      .eq('id', requestId);
    
    if (error) throw error;
  }
}
