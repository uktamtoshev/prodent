import { useState, useEffect } from 'react';
import { Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAddOnPricing, useCanPurchaseAddOn, type AddOnService } from '@/hooks/useAddOnServices';
import { resolveBillingIcon } from './billingIconMap';

interface AddOnPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: AddOnService | null;
  balance: number;
  onPurchase: (addOnId: string, durationDays: number, price: number) => void;
  isLoading?: boolean;
  entityType: 'doctor' | 'clinic';
  entityId: string;
}

export function AddOnPurchaseDialog({
  open,
  onOpenChange,
  service,
  balance,
  onPurchase,
  isLoading,
  entityType,
  entityId,
}: AddOnPurchaseDialogProps) {
  const { language, t } = useLanguage();
  const { data: pricing, isLoading: pricingLoading } = useAddOnPricing(service?.id || null);
  const { data: canPurchaseInfo, isLoading: checkLoading } = useCanPurchaseAddOn(
    service?.id || null,
    entityType,
    entityId
  );
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  // Reset selection when dialog opens with new service
  useEffect(() => {
    if (open && pricing && pricing.length > 0) {
      setSelectedDuration(pricing[0].duration_days);
    }
  }, [open, pricing]);

  if (!service) return null;

  const getName = () => {
    if (language === 'uz' && service.name_uz) return service.name_uz;
    return service.name;
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount);
  };

  const renderIcon = () => {
    const IconComponent = resolveBillingIcon(service.icon);
    return <IconComponent className="w-5 h-5" style={{ color: service.color }} />;
  };

  const getDurationLabel = (days: number) => {
    if (days === 7) return t('billingDialogs.duration7Days');
    if (days === 30) return t('billingDialogs.duration30Days');
    if (days === 90) return t('billingDialogs.duration90Days');
    return t('billingDialogs.durationDaysPlaceholder').replace('{n}', String(days));
  };

  const getSelectedPrice = () => {
    if (!selectedDuration || !pricing) return 0;
    const selected = pricing.find(p => p.duration_days === selectedDuration);
    return selected?.price || 0;
  };

  const canAfford = balance >= getSelectedPrice();
  const isExtension = canPurchaseInfo?.reason === 'extend';
  const canPurchase = canPurchaseInfo?.can_purchase !== false;
  const existingEndDate = canPurchaseInfo?.existing_end_date;

  // Calculate new end date (either from now or from existing end date if extending)
  const getNewEndDate = () => {
    if (!selectedDuration) return null;

    if (isExtension && existingEndDate) {
      return addDays(new Date(existingEndDate), selectedDuration);
    }
    return addDays(new Date(), selectedDuration);
  };

  const handleConfirm = () => {
    if (!selectedDuration || !service) return;
    onPurchase(service.id, selectedDuration, getSelectedPrice());
  };

  const newEndDate = getNewEndDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: service.bg_color }}
            >
              {renderIcon()}
            </div>
            {isExtension ? t('billingDialogs.extend') : t('billingDialogs.buy')} "{getName()}"
          </DialogTitle>
          <DialogDescription>
            {isExtension
              ? t('billingDialogs.extendDesc')
              : t('billingDialogs.buyDesc')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show extension info */}
          {isExtension && existingEndDate && (
            <Alert>
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                {t('billingDialogs.activeUntil').replace('{date}', format(new Date(existingEndDate), 'd MMMM yyyy', { locale: ru }))}
              </AlertDescription>
            </Alert>
          )}

          {/* Show error if cannot purchase */}
          {!canPurchase && canPurchaseInfo?.reason && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {canPurchaseInfo.reason}
              </AlertDescription>
            </Alert>
          )}

          {pricingLoading || checkLoading ? (
            <div className="h-10 bg-muted animate-pulse rounded" />
          ) : canPurchase && pricing && pricing.length > 0 ? (
            <Select
              value={selectedDuration?.toString() || ''}
              onValueChange={(v) => setSelectedDuration(Number(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('billingDialogs.choosePeriod')} />
              </SelectTrigger>
              <SelectContent>
                {pricing.map((option) => (
                  <SelectItem key={option.duration_days} value={option.duration_days.toString()}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>+ {getDurationLabel(option.duration_days)}</span>
                      <span className="text-muted-foreground">
                        {formatAmount(option.price)} UZS
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : canPurchase ? (
            <p className="text-muted-foreground text-center py-4">
              {t('billingDialogs.noOptions')}
            </p>
          ) : null}

          {selectedDuration && canPurchase && (
            <div className="p-4 rounded-lg bg-muted space-y-2">
              {isExtension && existingEndDate && (
                <div className="flex justify-between text-sm">
                  <span>{t('billingDialogs.currentTerm')}</span>
                  <span className="text-muted-foreground">
                    {t('billingDialogs.until')} {format(new Date(existingEndDate), 'd MMM yyyy', { locale: ru })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>{isExtension ? t('billingDialogs.adding') : t('billingDialogs.newPeriod')}</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  + {getDurationLabel(selectedDuration)}
                </span>
              </div>
              {newEndDate && (
                <div className="flex justify-between text-sm font-medium">
                  <span>{t('billingDialogs.newTermUntil')}</span>
                  <span className="text-primary">
                    {format(newEndDate, 'd MMMM yyyy', { locale: ru })}
                  </span>
                </div>
              )}
              <div className="border-t pt-2 mt-2" />
              <div className="flex justify-between font-medium">
                <span>{t('billingDialogs.costLabel')}</span>
                <span className="text-primary">{formatAmount(getSelectedPrice())} UZS</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t('billingDialogs.yourBalance')}</span>
                <span>{formatAmount(balance)} UZS</span>
              </div>
            </div>
          )}

          {selectedDuration && canPurchase && !canAfford && (
            <p className="text-sm text-destructive">
              {t('billingDialogs.insufficientReplenish')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || !selectedDuration || !canAfford || !canPurchase}
          >
            {isLoading ? (isExtension ? t('billingDialogs.extending') : t('billingDialogs.purchasing')) : (isExtension ? t('billingDialogs.extend') : t('billingDialogs.buy'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
