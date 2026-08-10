import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { GuestAppointmentModal } from "@/components/crm/appointments/GuestAppointmentModal";
import { useLanguage } from "@/contexts/LanguageContext";

interface StepFirstAppointmentProps {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function StepFirstAppointment({ onNext, onBack, onSkip }: StepFirstAppointmentProps) {
  const { t } = useLanguage();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Card className="border-border">
      <CardHeader className="text-center pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <UserPlus className="w-7 h-7 text-primary" />
        </div>
        <CardTitle className="text-xl">{t('crmStepFirstAppt.title')}</CardTitle>
        <CardDescription>
          {t('crmStepFirstAppt.desc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={() => setModalOpen(true)}
          className="w-full gap-2 h-12 text-base"
        >
          <UserPlus className="w-5 h-5" />
          {t('crmStepFirstAppt.bookPatient')}
        </Button>

        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          💡 {t('crmStepFirstAppt.hint')}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1">{t('crmStepFirstAppt.back')}</Button>
          <Button variant="ghost" onClick={onSkip} className="flex-1">{t('crmStepFirstAppt.skip')}</Button>
          <Button onClick={onNext} variant="outline" className="flex-1">{t('crmStepFirstAppt.finish')}</Button>
        </div>

        <GuestAppointmentModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          selectedDate={new Date()}
          onSuccess={() => {
            setModalOpen(false);
            onNext();
          }}
        />
      </CardContent>
    </Card>
  );
}
