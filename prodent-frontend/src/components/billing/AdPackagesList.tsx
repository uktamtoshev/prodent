import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Clock, Check, TrendingUp, Eye, Star, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AdPackagesListProps {
  targetType: 'doctor' | 'clinic';
  entityId: string;
  balance: number;
  onPurchase: (packageId: string, price: number) => void;
  isLoading?: boolean;
}

export function AdPackagesList({
  targetType,
  entityId,
  balance,
  onPurchase,
  isLoading,
}: AdPackagesListProps) {
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch ad packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['ad-packages', targetType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_packages')
        .select('*')
        .eq('target_type', targetType)
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Fetch active campaigns
  const { data: activeCampaigns } = useQuery({
    queryKey: ['active-campaigns', targetType, entityId],
    queryFn: async () => {
      const column = targetType === 'doctor' ? 'doctor_id' : 'clinic_id';
      const { data, error } = await supabase
        .from('ad_campaigns')
        .select('*, ad_packages(*)')
        .eq(column, entityId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString());

      if (error) throw error;
      return data;
    },
  });

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  const getPackageIcon = (packageType: string) => {
    switch (packageType) {
      case 'top_position':
        return <TrendingUp className="w-5 h-5" />;
      case 'featured':
        return <Star className="w-5 h-5" />;
      case 'banner':
        return <Megaphone className="w-5 h-5" />;
      case 'targeted':
        return <Target className="w-5 h-5" />;
      default:
        return <Eye className="w-5 h-5" />;
    }
  };

  const getPackageColor = (packageType: string) => {
    switch (packageType) {
      case 'top_position':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'featured':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/30';
      case 'banner':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'targeted':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleSelectPackage = (pkg: any) => {
    if (pkg.price > balance) {
      toast.error('Недостаточно средств на балансе. Пополните счёт.');
      return;
    }
    setSelectedPackage(pkg);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPackage) return;
    onPurchase(selectedPackage.id, selectedPackage.price);
    setIsConfirmOpen(false);
    setSelectedPackage(null);
  };

  if (packagesLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[250px]" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Active Campaigns */}
      {activeCampaigns && activeCampaigns.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Активные рекламные кампании
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((campaign) => (
              <Card key={campaign.id} className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{campaign.ad_packages?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        До {new Date(campaign.end_date).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">Активна</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Packages */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packages?.map((pkg) => {
          const canAfford = balance >= pkg.price;
          const colorClass = getPackageColor(pkg.package_type);

          return (
            <Card key={pkg.id} className={`relative transition-all hover:shadow-md ${colorClass}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClass}`}>
                    {getPackageIcon(pkg.package_type)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{pkg.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {pkg.duration_days} дней
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {pkg.description && (
                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">
                    {formatAmount(pkg.price)} <span className="text-sm font-normal">UZS</span>
                  </span>
                </div>
                <Button
                  className="w-full"
                  variant={canAfford ? 'default' : 'secondary'}
                  disabled={!canAfford || isLoading}
                  onClick={() => handleSelectPackage(pkg)}
                >
                  {canAfford ? 'Купить' : 'Недостаточно средств'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {packages?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Нет доступных рекламных пакетов</p>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение покупки</DialogTitle>
            <DialogDescription>
              Вы выбрали рекламный пакет "{selectedPackage?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between mb-2">
                <span>Пакет:</span>
                <span className="font-bold">{selectedPackage?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Длительность:</span>
                <span className="font-bold">{selectedPackage?.duration_days} дней</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Стоимость:</span>
                <span className="font-bold">
                  {formatAmount(selectedPackage?.price || 0)} UZS
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Текущий баланс:</span>
                <span className="font-bold text-green-600">{formatAmount(balance)} UZS</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>После оплаты:</span>
                <span className="font-bold">
                  {formatAmount(balance - (selectedPackage?.price || 0))} UZS
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>
                Отмена
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isLoading}>
                Подтвердить покупку
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
