import { useState, useMemo } from 'react';
import { Sparkles, Award, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  useAddOnServices,
  useActiveAddOns,
  usePurchaseAddOn,
  type AddOnService,
} from '@/hooks/useAddOnServices';
import { AddOnServiceCard } from './AddOnServiceCard';
import { AddOnPurchaseDialog } from './AddOnPurchaseDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { resolveBillingIcon } from './billingIconMap';

interface AddOnServicesListProps {
  targetType: 'doctor' | 'clinic';
  entityId: string;
  balance: number;
  virtualAccountId: string;
}

export function AddOnServicesList({
  targetType,
  entityId,
  balance,
  virtualAccountId,
}: AddOnServicesListProps) {
  const { t } = useLanguage();
  const [selectedService, setSelectedService] = useState<AddOnService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: services, isLoading: servicesLoading } = useAddOnServices(targetType);
  const { data: activeAddOns, isLoading: activeLoading } = useActiveAddOns(targetType, entityId);
  const purchaseMutation = usePurchaseAddOn();

  // Fetch minimum prices for each service
  const { data: minPrices } = useQuery({
    queryKey: ['add-on-min-prices', targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('add_on_pricing')
        .select('add_on_id, price')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;

      // Group by add_on_id and get minimum price
      const priceMap: Record<string, number> = {};
      data?.forEach(item => {
        if (!priceMap[item.add_on_id] || item.price < priceMap[item.add_on_id]) {
          priceMap[item.add_on_id] = item.price;
        }
      });
      return priceMap;
    },
  });

  const handleSelectService = (service: AddOnService) => {
    setSelectedService(service);
    setDialogOpen(true);
  };

  const handlePurchase = (addOnId: string, durationDays: number, price: number) => {
    purchaseMutation.mutate({
      addOnId,
      entityType: targetType,
      entityId,
      durationDays,
      price,
      virtualAccountId,
    }, {
      onSuccess: () => {
        setDialogOpen(false);
        setSelectedService(null);
      },
    });
  };

  const getActiveAddOn = (serviceId: string) => {
    return activeAddOns?.find(a => a.add_on_id === serviceId);
  };

  const renderIcon = (iconName: string, color: string) => {
    const IconComponent = resolveBillingIcon(iconName);
    return <IconComponent className="w-4 h-4" style={{ color }} />;
  };

  // Group services by type
  const groupedServices = useMemo(() => {
    if (!services) return { badges: [], promotions: [], frames: [] };

    return {
      badges: services.filter(s => s.service_type === 'badge'),
      promotions: services.filter(s => s.service_type === 'search_promotion'),
      frames: services.filter(s => s.service_type === 'profile_frame'),
    };
  }, [services]);

  if (servicesLoading || activeLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[180px] rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Add-ons Summary */}
      {activeAddOns && activeAddOns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {t('billingDialogs.activeServices')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeAddOns.map((addon) => (
              <Badge
                key={addon.add_on_id}
                className="px-3 py-1.5 text-sm font-medium gap-2"
                style={{
                  backgroundColor: addon.bg_color,
                  color: addon.color,
                  borderColor: addon.color,
                }}
              >
                {renderIcon(addon.icon, addon.color)}
                {addon.name}
                <span className="text-xs opacity-75 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('billingDialogs.until')} {format(new Date(addon.end_date), 'd MMM', { locale: ru })}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Services by Type */}
      <Tabs defaultValue="badges" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="badges" className="gap-2">
            <Award className="w-4 h-4" />
            {t('billingDialogs.tabBadges')}
          </TabsTrigger>
          <TabsTrigger value="promotions" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            {t('billingDialogs.tabPromotions')}
          </TabsTrigger>
          <TabsTrigger value="frames" className="gap-2">
            <Sparkles className="w-4 h-4" />
            {t('billingDialogs.tabFrames')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="badges" className="mt-4">
          {groupedServices.badges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('billingDialogs.noBadges')}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedServices.badges.map((service) => (
                <AddOnServiceCard
                  key={service.id}
                  service={service}
                  activeAddOn={getActiveAddOn(service.id)}
                  minPrice={minPrices?.[service.id] || 0}
                  onClick={() => handleSelectService(service)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="promotions" className="mt-4">
          {groupedServices.promotions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('billingDialogs.noPromotions')}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedServices.promotions.map((service) => (
                <AddOnServiceCard
                  key={service.id}
                  service={service}
                  activeAddOn={getActiveAddOn(service.id)}
                  minPrice={minPrices?.[service.id] || 0}
                  onClick={() => handleSelectService(service)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="frames" className="mt-4">
          {groupedServices.frames.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('billingDialogs.noFrames')}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedServices.frames.map((service) => (
                <AddOnServiceCard
                  key={service.id}
                  service={service}
                  activeAddOn={getActiveAddOn(service.id)}
                  minPrice={minPrices?.[service.id] || 0}
                  onClick={() => handleSelectService(service)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Purchase Dialog */}
      <AddOnPurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={selectedService}
        balance={balance}
        onPurchase={handlePurchase}
        isLoading={purchaseMutation.isPending}
        entityType={targetType}
        entityId={entityId}
      />
    </div>
  );
}
