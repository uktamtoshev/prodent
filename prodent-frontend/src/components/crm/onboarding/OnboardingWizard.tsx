import { useState } from "react";
import { Check, Building2, Users, ListChecks, Calendar, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClinic } from "@/contexts/ClinicContext";
import { StepClinicSetup } from "./steps/StepClinicSetup";
import { StepTeam } from "./steps/StepTeam";
import { StepPriceList } from "./steps/StepPriceList";
import { StepSchedule } from "./steps/StepSchedule";
import { StepFirstAppointment } from "./steps/StepFirstAppointment";
import { StepComplete } from "./steps/StepComplete";
import { supabase } from "@/integrations/api/client";
import type { Json } from "@/integrations/api/types";

const STEPS = [
  { id: "clinic", title: "Клиника", icon: Building2, description: "Основные данные" },
  { id: "team", title: "Команда", icon: Users, description: "Добавьте врачей" },
  { id: "services", title: "Прайс-лист", icon: ListChecks, description: "Настройте услуги" },
  { id: "schedule", title: "Расписание", icon: Calendar, description: "Рабочие часы" },
  { id: "appointment", title: "Первая запись", icon: UserPlus, description: "Запишите пациента" },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
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
    if (currentClinic?.id) {
      await supabase.from("clinic_settings").upsert(
        [{
          clinic_id: currentClinic.id,
          key: "onboarding_completed",
          value: true as unknown as Json,
          description: "Онбординг завершён",
        }],
        { onConflict: "clinic_id,key" }
      );
    }
    setCompleted(true);
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
          Шаг {currentStep + 1} из {STEPS.length}: {STEPS[currentStep].description}
        </p>
      </div>

      {/* Step content */}
      <div className="flex-1 px-4 lg:px-8 pb-8">
        <div className="max-w-2xl mx-auto">
          {currentStep === 0 && <StepClinicSetup onNext={handleNext} />}
          {currentStep === 1 && <StepTeam onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
          {currentStep === 2 && <StepPriceList onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
          {currentStep === 3 && <StepSchedule onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
          {currentStep === 4 && <StepFirstAppointment onNext={handleNext} onBack={handleBack} onSkip={handleSkip} />}
        </div>
      </div>
    </div>
  );
}
