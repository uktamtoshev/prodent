import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface StepCompleteProps {
  onFinish: () => void;
}

export function StepComplete({ onFinish }: StepCompleteProps) {
  const { t } = useLanguage();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <Card className="border-border max-w-md w-full">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{t('crmStepComplete.allReady')} 🎉</h2>
          <p className="text-muted-foreground">
            {t('crmStepComplete.readyDesc')}
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">{t('crmStepComplete.schedule')}</p>
              <p className="text-muted-foreground text-xs">{t('crmStepComplete.scheduleDesc')}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">{t('crmStepComplete.patients')}</p>
              <p className="text-muted-foreground text-xs">{t('crmStepComplete.patientsDesc')}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">{t('crmStepComplete.finance')}</p>
              <p className="text-muted-foreground text-xs">{t('crmStepComplete.financeDesc')}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-medium text-foreground">{t('crmStepComplete.reports')}</p>
              <p className="text-muted-foreground text-xs">{t('crmStepComplete.reportsDesc')}</p>
            </div>
          </div>
          <Button onClick={onFinish} className="w-full gap-2 mt-4">
            {t('crmStepComplete.goToDashboard')} <ArrowRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
