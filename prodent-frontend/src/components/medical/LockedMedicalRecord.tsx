import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Clock, CheckCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface LockedMedicalRecordProps {
  onRequestAccess: () => void;
  isPending?: boolean;
  pendingRequestDate?: string;
  hasAccess?: boolean;
  accessExpiresAt?: Date | null;
}

export function LockedMedicalRecord({
  onRequestAccess,
  isPending = false,
  pendingRequestDate,
  hasAccess = false,
  accessExpiresAt
}: LockedMedicalRecordProps) {
  const { t } = useLanguage();

  if (hasAccess && accessExpiresAt) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-medium text-emerald-700 dark:text-emerald-400">
                  {t('medicalAccess.accessActiveTitle')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('medicalAccess.until')} {format(accessExpiresAt, "d MMMM, HH:mm", { locale: ru })}
                  <span className="ml-1">
                    ({formatDistanceToNow(accessExpiresAt, { locale: ru, addSuffix: true })})
                  </span>
                </p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              <Clock className="w-3 h-3 mr-1" />
              {t('medicalAccess.accessActiveBadge')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isPending) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-full bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <div>
              <h4 className="font-semibold text-amber-700 dark:text-amber-400">
                {t('medicalAccess.awaitingApproval')}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {t('medicalAccess.requestSentToPatient')}
                {pendingRequestDate && (
                  <span className="block">
                    {format(new Date(pendingRequestDate), "d MMMM HH:mm", { locale: ru })}
                  </span>
                )}
              </p>
            </div>
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              {t('medicalAccess.pendingConfirmationBadge')}
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="py-12">
        <div className="text-center space-y-6">
          <div className="inline-flex p-4 rounded-full bg-muted">
            <Lock className="h-10 w-10 text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-lg">
              {t('medicalAccess.cardProtectedTitle')}
            </h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t('medicalAccess.cardProtectedDesc')}
            </p>
          </div>

          <Button onClick={onRequestAccess} className="gap-2">
            <Shield className="h-4 w-4" />
            {t('medicalAccess.requestMedicalCardAccess')}
          </Button>

          <p className="text-xs text-muted-foreground">
            {t('medicalAccess.patientWillBeNotified')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
