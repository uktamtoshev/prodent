import { Check, Clock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { AddOnService, ActiveAddOn } from '@/hooks/useAddOnServices';

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
  const { language } = useLanguage();
  const isActive = !!activeAddOn;

  const getName = () => {
    if (language === 'uz' && service.name_uz) return service.name_uz;
    if (language === 'en' && service.name_en) return service.name_en;
    return service.name;
  };

  const getDescription = () => {
    if (language === 'uz' && service.description_uz) return service.description_uz;
    if (language === 'en' && service.description_en) return service.description_en;
    return service.description;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const renderIcon = () => {
    const IconComponent = (LucideIcons as any)[service.icon] || LucideIcons.Award;
    return <IconComponent className="w-6 h-6" style={{ color: service.color }} />;
  };

  const getServiceTypeLabel = () => {
    switch (service.service_type) {
      case 'badge':
        return 'Бейдж';
      case 'search_promotion':
        return 'Продвижение';
      case 'profile_frame':
        return 'Рамка профиля';
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
            Активен
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
            <span>до {format(new Date(activeAddOn.end_date), 'd MMM yyyy', { locale: ru })}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">от</span>
            <span className="font-bold text-primary">
              {formatAmount(minPrice)} UZS
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
