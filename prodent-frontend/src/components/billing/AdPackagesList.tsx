import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Clock, TrendingUp, Eye, Star, Target } from 'lucide-react';
import { useAdPackages } from '@/hooks/useAdCampaigns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import type { AdPackage } from '@/hooks/useAdCampaigns';

interface AdPackagesListProps {
  targetType: 'doctor' | 'clinic';
  entityId: string;
  balance: number;
  onPurchase: (packageId: string, price: number) => void;
  isLoading?: boolean;
}

type CampaignRow = {
  id: string;
  status?: string;
  starts_at?: string;
  start_date?: string;
  ends_at?: string;
  end_date?: string;
  package_id?: string;
  packageId?: string;
  doctor_id?: string;
  clinic_id?: string;
};

type ActiveCampaign = CampaignRow & {
  status?: string;
  start_date?: string;
  end_date?: string;
  ad_packages?: AdPackage;
};

export function AdPackagesList({
  targetType,
  entityId,
  balance,
  onPurchase,
  isLoading,
}: AdPackagesListProps) {
  const { t } = useLanguage();
  const [selectedPackage, setSelectedPackage] = useState<AdPackage | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Fetch ad packages via the REST hook (sorted by price ascending client-side
  // for parity with the legacy query).
  const { data: packagesRaw, isLoading: packagesLoading } = useAdPackages(targetType);
  const packages = (packagesRaw ?? []).slice().sort((a, b) => a.price - b.price);

  // Fetch the caller's own active campaigns for the matching entity. The new
  // REST API exposes `/campaigns/mine` (authenticated). The package object is
  // not joined into the response, so we resolve names from the loaded
  // package catalogue when rendering.
  const { data: activeCampaigns } = useQuery({
    queryKey: ['ad-campaigns-mine-active', targetType, entityId],
    queryFn: async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('prodent_access_token') : null;
      const res = await fetch('/api/v1/ads/campaigns/mine', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return [];
      const list: unknown = await res.json();
      if (!Array.isArray(list)) return [];
      const nowIso = new Date().toISOString();
      const colId = targetType === 'doctor' ? 'doctor_id' : 'clinic_id';
      return list
        .map((c): ActiveCampaign => {
          const campaign = c as CampaignRow;
          return {
            ...campaign,
            status: typeof campaign.status === 'string' ? campaign.status.toLowerCase() : campaign.status,
            start_date: campaign.starts_at ?? campaign.start_date,
            end_date: campaign.ends_at ?? campaign.end_date,
            ad_packages: (packagesRaw ?? []).find((p) => p.id === (campaign.package_id ?? campaign.packageId)),
          };
        })
        .filter(
          (c) =>
            c[colId] === entityId &&
            c.status === 'active' &&
            (!c.end_date || c.end_date >= nowIso),
        );
    },
    enabled: !!entityId,
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

  const handleSelectPackage = (pkg: AdPackage) => {
    if (pkg.price > balance) {
      toast.error(t('billingDialogs.insufficientFunds'));
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
            {t('billingDialogs.activeCampaigns')}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeCampaigns.map((campaign) => (
              <Card key={campaign.id} className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{campaign.ad_packages?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('billingDialogs.until')} {new Date(campaign.end_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">{t('billingDialogs.activeBadge')}</Badge>
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
                      {pkg.duration_days} {t('billingDialogs.days')}
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
                  {canAfford ? t('billingDialogs.buyBtn') : t('billingDialogs.insufficientFundsBtn')}
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
            <p className="text-muted-foreground">{t('billingDialogs.noAdPackages')}</p>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billingDialogs.confirmPurchase')}</DialogTitle>
            <DialogDescription>
              {t('billingDialogs.youSelectedAd')} "{selectedPackage?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.packageLabel')}</span>
                <span className="font-bold">{selectedPackage?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.durationDays')}</span>
                <span className="font-bold">{selectedPackage?.duration_days} {t('billingDialogs.days')}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.cost')}</span>
                <span className="font-bold">
                  {formatAmount(selectedPackage?.price || 0)} UZS
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.currentBalance')}</span>
                <span className="font-bold text-green-600">{formatAmount(balance)} UZS</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>{t('billingDialogs.afterPayment')}</span>
                <span className="font-bold">
                  {formatAmount(balance - (selectedPackage?.price || 0))} UZS
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isLoading}>
                {t('billingDialogs.confirmPurchaseBtn')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
