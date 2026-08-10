import { useMemo, useState } from "react";
import { Check, Users, ListChecks, Calendar, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinic } from "@/contexts/ClinicContext";
import { StepTeam } from "./steps/StepTeam";
import { StepPriceList } from "./steps/StepPriceList";
import { StepSchedule } from "./steps/StepSchedule";
import { StepFirstAppointment } from "./steps/StepFirstAppointment";
import { StepComplete } from "./steps/StepComplete";
import { useLanguage } from "@/contexts/LanguageContext";
import { saveClinicSetting } from "@/lib/clinic-settings";
import { toast } from "sonner";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { t } = useLanguage();
  // The clinic's own details (name, phone, region/district, address, map point,
  // description) come from the application the admin approved — asking for them
  // again here was a duplicate, and the clinic cannot edit verified data itself.
  const STEPS = useMemo(() => [
    { id: "team", title: t('crmOnboarding.stepTeam'), icon: Users, description: t('crmOnboarding.stepTeamDesc') },
    { id: "services", title: t('crmOnboarding.stepServices'), icon: ListChecks, description: t('crmOnboarding.stepServicesDesc') },
    { id: "schedule", title: t('crmOnboarding.stepSchedule'), icon: Calendar, description: t('crmOnboarding.stepScheduleDesc') },
    { id: "appointment", title: t('crmOnboarding.stepAppt'), icon: UserPlus, description: t('crmOnboarding.stepApptDesc') },
  ], [t]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const { currentClinic } = useClinic();

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      markOnboardingComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    handleNext();
  };

  const markOnboardingComplete = async () => {
    try {
      if (currentClinic?.id) {
        await saveClinicSetting(currentClinic.id, "onboarding_completed", true);
      }
      setCompleted(true);
    } catch {
      toast.error(t('crmStepSchedule.saveError'));
    }
  };

  if (completed) {
    return <StepComplete onFinish={onComplete} />;
  }

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Progress stepper */}
      <div className="px-4 py-6 lg:px-8">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isDone = index < currentStep;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      isDone && "bg-primary text-primary-foreground",
                      isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      !isDone && !isActive && "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 font-medium hidden sm:block",
                      isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                      isDone ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('crmOnboarding.stepLabel')} {currentStep + 1} {t('crmOnboarding.stepOf')} {STEPS.length}: {STEPS[currentStep].description}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 lg:px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          {currentStep === 0 && <StepTeam onNext={handleNext} onSkip={handleSkip} />}
          {currentStep === 1 && <StepPriceList onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
          {currentStep === 2 && <StepSchedule onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
          {currentStep === 3 && <StepFirstAppointment onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
        </div>
      </div>
    </div>
  );
}
