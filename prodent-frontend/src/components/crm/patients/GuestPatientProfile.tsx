import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { prepareGuestInvitation } from "@/lib/appointment-api";
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
import { useLanguage } from "@/contexts/LanguageContext";

interface GuestPatient {
  id: string;
  name: string;
  phone: string;
  comment?: string | null;
  sms_consent: boolean;
  status: "guest" | "invitation_prepared" | "invited" | "converted";
  created_at: string;
  invitation_sent_at?: string | null;
}

interface GuestPatientProfileProps {
  patient: GuestPatient;
  onUpdate?: () => void;
}

export function GuestPatientProfile({ patient, onUpdate }: GuestPatientProfileProps) {
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const prepareInvitation = async () => {
    setSending(true);
    try {
      await prepareGuestInvitation(patient.id);

      toast.success(t('crmGuestProfile.invitationSentToast'), {
        description: `${t('crmGuestProfile.smsSentTo')} ${patient.phone}`,
      });

      onUpdate?.();
    } catch (error) {
      console.error("Error preparing invitation:", error);
      toast.error(t('crmGuestProfile.sendError'));
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = () => {
    switch (patient.status) {
      case "invitation_prepared":
      case "invited":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <Send className="h-3 w-3 mr-1" />
            {t('crmGuestProfile.invited')}
          </Badge>
        );
      case "converted":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            {t('crmGuestProfile.registered')}
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
            <Avatar className="h-16 w-16 border-2 border-border dark:border-border">
              <AvatarFallback className="text-lg font-semibold bg-muted dark:bg-slate-800 text-muted-foreground dark:text-muted-foreground">
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
                  {t('crmGuestProfile.added')} {format(new Date(patient.created_at), "d MMMM yyyy", { locale: ru })}
                </span>
              </div>
            </div>

            {/* Invite Button */}
            {patient.status === "guest" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    {t('crmGuestProfile.inviteToCreateAccount')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('crmGuestProfile.sendInvitationQ')}</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                      <p>
                        {t('crmGuestProfile.patientWillReceiveSms')}
                      </p>
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        <p className="font-medium text-foreground">
                          {patient.phone}
                        </p>
                        <p className="text-muted-foreground mt-2">
                          "{t('crmGuestProfile.smsTextSample')}"
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('crmGuestProfile.afterRegistrationHistory')}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('crmGuestProfile.cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={prepareInvitation} disabled={sending}>
                      {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      {t('crmGuestProfile.sendSms')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {(patient.status === "invitation_prepared" || patient.status === "invited") && (
              <div className="text-sm text-muted-foreground text-right">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    {t('crmGuestProfile.invitationSent')}
                    {patient.invitation_sent_at && (
                      <> {format(new Date(patient.invitation_sent_at), "d MMM в HH:mm", { locale: ru })}</>
                    )}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={prepareInvitation} disabled={sending}>
                  {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : t('crmGuestProfile.sendAgain')}
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
            {t('crmGuestProfile.smsReminders')}: {patient.sms_consent ? `✓ ${t('crmGuestProfile.consentYes')}` : `✗ ${t('crmGuestProfile.consentNo')}`}
          </div>
        </CardContent>
      </Card>

      {/* Medical Records Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            {t('crmGuestProfile.medicalCard')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{t('crmGuestProfile.guestRecords')}</p>
            <p className="text-sm mt-1">
              {t('crmGuestProfile.addNotesAndFiles')}
            </p>
            <Button variant="outline" className="mt-4">
              {t('crmGuestProfile.addRecord')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
