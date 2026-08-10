import { Button } from '@/components/ui/button';
import { Stethoscope, ListPlus, Plus, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ServicesEmptyStateProps {
  onAddStandard: () => void;
  onAddCustom: () => void;
  isLoading?: boolean;
  canEdit?: boolean;
}

export function ServicesEmptyState({
  onAddStandard,
  onAddCustom,
  isLoading,
  canEdit = true,
}: ServicesEmptyStateProps) {
  const { t } = useLanguage();
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
        {t('managerRole.emptyTitle')}
      </h3>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        {t('managerRole.emptyDesc')}
      </p>

      {/* Quick Tips */}
      <div className="bg-muted/30 rounded-xl p-4 mb-8 max-w-md w-full">
        <h4 className="text-sm font-medium text-foreground mb-3">{t('managerRole.emptyTipsTitle')}</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('managerRole.emptyTip1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('managerRole.emptyTip2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>{t('managerRole.emptyTip3')}</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      {canEdit && <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          onClick={onAddStandard}
          disabled={isLoading}
          className="gap-2 min-w-[200px]"
        >
          <ListPlus className="w-4 h-4" />
          {t('managerRole.emptyAddStandard')}
        </Button>
        <Button
          onClick={onAddCustom}
          className="gap-2 min-w-[200px]"
        >
          <Plus className="w-4 h-4" />
          {t('managerRole.emptyCreateOwn')}
        </Button>
      </div>}

      {/* Help Link */}
      <p className="text-xs text-muted-foreground mt-6">
        {t('managerRole.emptyHelpQuestion')}{' '}
        <button className="text-primary hover:underline">
          {t('managerRole.emptyShowGuide')}
        </button>
      </p>
    </div>
  );
}
