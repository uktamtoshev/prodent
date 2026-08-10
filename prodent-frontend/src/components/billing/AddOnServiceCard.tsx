import { Check, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AddOnService, ActiveAddOn } from '@/hooks/useAddOnServices';
import { resolveBillingIcon } from './billingIconMap';

interface AddOnServiceCardProps {
  service: AddOnService;
  activeAddOn?: ActiveAddOn;
  minPrice: number;
  onClick: () => void;
  disabled?: boolean;
}

export function AddOnServiceCard({
  service,
  activeAddOn,
  minPrice,
  onClick,
  disabled,
}: AddOnServiceCardProps) {
  const { language, t } = useLanguage();
  const isActive = !!activeAddOn;

  const getName = () => {
    if (language === 'uz' && service.name_uz) return service.name_uz;
    return service.name;
  };

  const getDescription = () => {
    if (language === 'uz' && service.description_uz) return service.description_uz;
    return service.description;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const renderIcon = () => {
    const IconComponent = resolveBillingIcon(service.icon);
    return <IconComponent className="w-6 h-6" style={{ color: service.color }} />;
  };

  const getServiceTypeLabel = () => {
    switch (service.service_type) {
      case 'badge':
        return t('billingDialogs.typeBadge');
      case 'search_promotion':
        return t('billingDialogs.typePromotion');
      case 'profile_frame':
        return t('billingDialogs.typeFrame');
      default:
        return '';
    }
  };

  return (
    <Card
      className={`relative cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'ring-2 ring-primary/50' : ''
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && !isActive && onClick()}
    >
      {isActive && (
        <div className="absolute top-2 right-2">
          <Badge variant="default" className="gap-1 bg-primary">
            <Check className="w-3 h-3" />
            {t('billingDialogs.activeBtn')}
          </Badge>
        </div>
      )}

      <div className="absolute top-2 left-2">
        <Badge variant="outline" className="text-xs">
          {getServiceTypeLabel()}
        </Badge>
      </div>

      <CardHeader className="pb-2 pt-10">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center mb-2"
          style={{ backgroundColor: service.bg_color }}
        >
          {renderIcon()}
        </div>
        <CardTitle className="text-lg" style={{ color: service.color }}>
          {getName()}
        </CardTitle>
        {service.description && (
          <CardDescription className="text-sm">
            {getDescription()}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {isActive ? (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{t('billingDialogs.until')} {format(new Date(activeAddOn.end_date), 'd MMM yyyy', { locale: ru })}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('billingDialogs.from')}</span>
            <span className="font-bold text-primary">
              {formatAmount(minPrice)} UZS
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
