import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { supabase } from "@/integrations/api/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Phone, 
  Calendar, 
  MessageSquare, 
  Send, 
  UserPlus,
  Clock,
  CheckCircle,
  Loader2,
  FileText,
  Stethoscope
} from "lucide-react";
import { GuestBadge } from "./GuestBadge";

interface GuestPatient {
  id: string;
  name: string;
  phone: string;
  comment?: string | null;
  sms_consent: boolean;
  status: "guest" | "invited" | "converted";
  created_at: string;
  invitation_sent_at?: string | null;
}

interface GuestPatientProfileProps {
  patient: GuestPatient;
  onUpdate?: () => void;
}

export function GuestPatientProfile({ patient, onUpdate }: GuestPatientProfileProps) {
  const [sending, setSending] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const sendInvitation = async () => {
    setSending(true);
    try {
      // Generate invitation token
      const token = crypto.randomUUID();
      
      // Update guest patient with invitation info
      const { error } = await supabase
        .from("guest_patients")
        .update({
          status: "invited",
          invitation_token: token,
          invitation_sent_at: new Date().toISOString(),
        })
        .eq("id", patient.id);

      if (error) throw error;

      // TODO: Send actual SMS via Play Mobile
      // For now, just show success message as a stub
      toast.success("Приглашение отправлено", {
        description: `SMS отправлено на номер ${patient.phone}`,
      });

      onUpdate?.();
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Ошибка отправки приглашения");
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = () => {
    switch (patient.status) {
      case "invited":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <Send className="h-3 w-3 mr-1" />
            Приглашён
          </Badge>
        );
      case "converted":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Зарегистрирован
          </Badge>
        );
      default:
        return <GuestBadge />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-slate-200 dark:border-slate-700">
              <AvatarFallback className="text-lg font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {getInitials(patient.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">{patient.name}</h2>
                {getStatusBadge()}
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{patient.phone}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Calendar className="h-4 w-4" />
                <span>
                  Добавлен {format(new Date(patient.created_at), "d MMMM yyyy", { locale: ru })}
                </span>
              </div>
            </div>

            {/* Invite Button */}
            {patient.status === "guest" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Пригласить создать аккаунт
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Отправить приглашение?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        Пациенту будет отправлено SMS с приглашением создать аккаунт:
                      </p>
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        <p className="font-medium text-foreground">
                          {patient.phone}
                        </p>
                        <p className="text-muted-foreground mt-2">
                          "Вы были на приёме в клинике. Хотите видеть историю лечения и записываться онлайн? Создайте аккаунт за 30 секунд."
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        После регистрации вся история пациента будет сохранена.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={sendInvitation} disabled={sending}>
                      {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Отправить SMS
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {patient.status === "invited" && (
              <div className="text-sm text-muted-foreground text-right">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    Приглашение отправлено
                    {patient.invitation_sent_at && (
                      <> {format(new Date(patient.invitation_sent_at), "d MMM в HH:mm", { locale: ru })}</>
                    )}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={sendInvitation} disabled={sending}>
                  {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Отправить повторно"}
                </Button>
              </div>
            )}
          </div>

          {/* Comment */}
          {patient.comment && (
            <>
              <Separator className="my-4" />
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">{patient.comment}</p>
              </div>
            </>
          )}

          {/* SMS Consent */}
          <div className="mt-4 text-xs text-muted-foreground">
            SMS-напоминания: {patient.sms_consent ? "✓ Согласен" : "✗ Не согласен"}
          </div>
        </CardContent>
      </Card>

      {/* Medical Records Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            Медицинская карта
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Медицинские записи гостевого пациента</p>
            <p className="text-sm mt-1">
              Добавляйте диагнозы, заметки и файлы
            </p>
            <Button variant="outline" className="mt-4">
              Добавить запись
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
