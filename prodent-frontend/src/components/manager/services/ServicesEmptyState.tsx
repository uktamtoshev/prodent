import { Button } from '@/components/ui/button';
import { Stethoscope, ListPlus, Plus, Sparkles } from 'lucide-react';

interface ServicesEmptyStateProps {
  onAddStandard: () => void;
  onAddCustom: () => void;
  isLoading?: boolean;
}

export function ServicesEmptyState({ 
  onAddStandard, 
  onAddCustom, 
  isLoading 
}: ServicesEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <Stethoscope className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
      </div>

      {/* Text */}
      <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
        Начните с создания прайс-листа
      </h3>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Добавьте услуги клиники, чтобы назначать их врачам и отслеживать в записях пациентов
      </p>

      {/* Quick Tips */}
      <div className="bg-muted/30 rounded-xl p-4 mb-8 max-w-md w-full">
        <h4 className="text-sm font-medium text-foreground mb-3">💡 Советы для быстрого старта</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Используйте «Стандартные услуги» для загрузки популярных процедур</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Группируйте услуги по категориям для удобной навигации</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Назначайте услуги врачам с индивидуальными ценами</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="outline" 
          onClick={onAddStandard}
          disabled={isLoading}
          className="gap-2 min-w-[200px]"
        >
          <ListPlus className="w-4 h-4" />
          Добавить стандартные услуги
        </Button>
        <Button 
          onClick={onAddCustom}
          className="gap-2 min-w-[200px]"
        >
          <Plus className="w-4 h-4" />
          Создать свою услугу
        </Button>
      </div>

      {/* Help Link */}
      <p className="text-xs text-muted-foreground mt-6">
        Нужна помощь?{' '}
        <button className="text-primary hover:underline">
          Смотреть инструкцию
        </button>
      </p>
    </div>
  );
}
