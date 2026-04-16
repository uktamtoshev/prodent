import { UserPlus, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PatientsEmptyStateProps {
  onAddPatient: () => void;
  isFiltered?: boolean;
  isPersonalPatients?: boolean;
}

export function PatientsEmptyState({ 
  onAddPatient, 
  isFiltered = false,
  isPersonalPatients = false 
}: PatientsEmptyStateProps) {
  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
            <path d="M8 11h6" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Пациенты не найдены
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          Попробуйте изменить параметры поиска или сбросить фильтры, чтобы увидеть больше результатов
        </p>
        <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
          Сбросить все фильтры
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-700 flex items-center justify-center">
          <svg className="w-16 h-16 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {isPersonalPatients 
          ? "Добавьте своего первого пациента" 
          : "Ваша база пациентов пуста"}
      </h3>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {isPersonalPatients 
          ? "Приглашайте пациентов для ведения их карточек, планирования визитов и истории лечения"
          : "Начните добавлять пациентов в систему для управления записями, ведения истории лечения и учёта платежей"}
      </p>

      {/* CTA */}
      <Button 
        onClick={onAddPatient} 
        size="lg"
        className="gap-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900"
      >
        <UserPlus className="w-4 h-4" />
        Добавить первого пациента
      </Button>

      {/* Tips */}
      <div className="mt-12 grid gap-4 sm:grid-cols-3 max-w-2xl w-full">
        <TipCard
          icon={<UserPlus className="w-5 h-5" />}
          title="Быстрое добавление"
          description="Найдите пациента по номеру телефона и отправьте приглашение"
        />
        <TipCard
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>}
          title="Теги и метки"
          description="Помечайте VIP-клиентов, детей или аллергиков для быстрого поиска"
        />
        <TipCard
          icon={<BookOpen className="w-5 h-5" />}
          title="История лечения"
          description="Вся информация о визитах и процедурах в одном месте"
        />
      </div>

      {/* Help link */}
      <a 
        href="#" 
        className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        Узнать больше о работе с пациентами
        <ArrowRight className="w-3 h-3" />
      </a>
    </div>
  );
}

function TipCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) {
  return (
    <div className="flex flex-col items-center text-center p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700">
      <div className="w-10 h-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 flex items-center justify-center mb-3 text-neutral-600 dark:text-neutral-400">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
