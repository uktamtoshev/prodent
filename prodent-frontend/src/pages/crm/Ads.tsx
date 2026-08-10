import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, TrendingUp, Calendar, Crown, Star, Info } from "lucide-react";
import {
  useAdPackages,
  useMyAdCampaigns,
  useCreateCampaign,
  AdPackage,
} from "@/hooks/useAdCampaigns";
import { AdPackagesList } from "@/components/billing/AdPackagesList";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const packageTypeIcons: Record<string, React.ReactNode> = {
  top_day: <Star className="w-5 h-5" />,
  top_week: <TrendingUp className="w-5 h-5" />,
  top_month: <Crown className="w-5 h-5" />,
  banner: <Megaphone className="w-5 h-5" />,
};

export default function Ads() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { data: packagesRaw } = useAdPackages('clinic');
  const { data: myCampaigns } = useMyAdCampaigns();
  const createCampaign = useCreateCampaign();

  const packageById = useMemo(() => {
    const map: Record<string, AdPackage> = {};
    (packagesRaw ?? []).forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [packagesRaw]);

  const packageTypeLabels = useMemo<Record<string, string>>(
    () => ({
      top_day: t('crmAds.packageTopDay'),
      top_week: t('crmAds.packageTopWeek'),
      top_month: t('crmAds.packageTopMonth'),
      banner: t('crmAds.packageBanner'),
    }),
    [t],
  );

  // /campaigns/mine already filters by ownerId on the server; we additionally
  // narrow to the currently selected clinic when a clinic context is set.
  const clinicCampaigns = (myCampaigns ?? []).filter(
    (c) => !currentClinic?.id || c.clinic_id === currentClinic.id,
  );
  const activeCampaigns = clinicCampaigns.filter((c) => c.status === 'active');

  // Honest purchase handler: there is no real payment flow for ad packages yet
  // (no charge against a virtual account / gateway). Previously this created a
  // campaign as a "manual transfer pending" record while faking an unlimited
  // balance to bypass the affordability gate, and showed a "submitted" success
  // toast even though nothing was actually paid. Until the real billing flow is
  // wired up, do NOT create a fake campaign — tell the user honestly it's coming
  // soon. (Param kept for the AdPackagesList signature.)
  const handlePurchase = (_packageId: string) => {
    toast.info(t('crmAds.selfServeNote'));
  };

  return (
    <CRMLayout>
      <div className="space-y-6 p-4 pb-24 lg:p-6">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t('crmAds.title')}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('crmAds.description')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
            {activeCampaigns.length} {t('crmAds.activeCampaigns')}
          </Badge>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1">
            {(packagesRaw ?? []).length} {t('crmAds.availablePackages')}
          </Badge>
        </div>

        {/* Active Campaigns */}
        {activeCampaigns.length > 0 && (
          <Card className="overflow-hidden border-status-success/30 bg-status-success/5 shadow-soft">
            <CardHeader className="border-b border-status-success/20 bg-status-success/5">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <TrendingUp className="h-5 w-5 text-status-success" />
                {t('crmAds.activeCampaigns')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-4">
                {activeCampaigns.map((campaign) => {
                  const pkg = packageById[campaign.package_id];
                  const daysLeft = differenceInDays(
                    new Date(campaign.end_date),
                    new Date(),
                  );
                  return (
                    <div
                      key={campaign.id}
                      className="flex flex-col gap-3 rounded-panel border border-border/50 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-primary/10 p-2 text-primary">
                          {packageTypeIcons[pkg?.package_type || 'banner']}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{pkg?.name || campaign.title || '—'}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('common.to')}{' '}
                            {format(new Date(campaign.end_date), 'd MMMM yyyy', {
                              locale: ru,
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right">
                        <Badge
                          variant="outline"
                          className={cn(
                            daysLeft <= 3
                              ? 'border-status-warning text-status-warning'
                              : 'border-status-success text-status-success',
                          )}
                        >
                          {daysLeft} {t('crmAds.daysLeft')}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Packages — self-serve purchase via shared AdPackagesList */}
        <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
          <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Megaphone className="h-5 w-5" />
              {t('crmAds.availablePackages')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-start gap-3 rounded-2xl border border-status-info/20 bg-status-info/5 p-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-info" />
              <p className="text-sm text-foreground">
                {t('crmAds.selfServeNote')}
              </p>
            </div>

            {/* Read-only catalogue. balance=0 keeps the purchase buttons
                disabled so we never fake a payment / unlimited funds. */}
            <AdPackagesList
              targetType="clinic"
              entityId={currentClinic?.id || ''}
              balance={0}
              isLoading={createCampaign.isPending}
              onPurchase={(packageId) => {
                handlePurchase(packageId);
              }}
            />
          </CardContent>
        </Card>

        {/* Campaign History */}
        {clinicCampaigns.length > 0 && (
          <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
            <CardHeader className="border-b border-border/50 bg-surface-2 px-card-x py-card-y">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Calendar className="h-5 w-5" />
                {t('crmAds.campaignHistory')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {clinicCampaigns.map((campaign) => {
                  const pkg = packageById[campaign.package_id];
                  return (
                    <div
                      key={campaign.id}
                      className="flex flex-col gap-3 rounded-panel border border-border/50 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="rounded-full">
                          {packageTypeLabels[pkg?.package_type || 'banner']}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(campaign.start_date), 'd MMM', {
                            locale: ru,
                          })}{' '}
                          —{' '}
                          {format(new Date(campaign.end_date), 'd MMM yyyy', {
                            locale: ru,
                          })}
                        </span>
                      </div>
                      <Badge
                        className={cn(
                          campaign.status === 'active'
                            ? 'bg-status-success/10 text-status-success'
                            : campaign.status === 'completed'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-status-warning/10 text-status-warning',
                        )}
                      >
                        {campaign.status === 'active'
                          ? t('crmAds.statusActive')
                          : campaign.status === 'completed'
                            ? t('crmAds.statusCompleted')
                            : campaign.status === 'cancelled'
                              ? t('crmAds.statusCancelled')
                              : t('crmAds.statusPending')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}
