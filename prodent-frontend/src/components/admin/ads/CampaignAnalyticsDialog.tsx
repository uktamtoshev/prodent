import { lazy, Suspense } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ru, uz, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { Eye, MousePointer, BarChart3, Building2, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCampaignAnalyticsRows } from '@/hooks/useAdCampaigns';

const CampaignPerformanceChart = lazy(() =>
  import('./CampaignPerformanceChart').then((module) => ({
    default: module.CampaignPerformanceChart,
  })),
);

interface CampaignAnalyticsDialogProps {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  campaign: {
    doctor?: {
      profiles?: { full_name: string; avatar_url?: string };
      specialty: string;
    };
    clinic?: { name: string };
    start_date: string;
    end_date: string;
    package?: { name: string; package_type: string };
  };
}

const DATE_LOCALES: Record<string, Locale> = {
  ru,
  uz,
  en: enUS,
};

export function CampaignAnalyticsDialog({ campaignId, isOpen, onClose, campaign }: CampaignAnalyticsDialogProps) {
  const { t, language } = useLanguage();
  const dateLocale = DATE_LOCALES[language] ?? ru;

  // Consume the REST analytics endpoint (GET /api/v1/ads/campaigns/{id}/analytics)
  // which returns one aggregated row per day. The old direct `ad_analytics`
  // table query no longer exists server-side and 500'd.
  const { data: rows, isLoading } = useCampaignAnalyticsRows(campaignId, isOpen);

  // Aggregate totals across daily rows. Only impressions and clicks are tracked
  // by the backend; profile_views / appointments are not, so they are omitted.
  const stats = (() => {
    let impressions = 0;
    let clicks = 0;
    for (const r of rows ?? []) {
      impressions += Number(r.impressions ?? 0);
      clicks += Number(r.clicks ?? 0);
    }
    return { impressions, clicks };
  })();

  const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0';

  // Chart data: one point per daily row, ordered chronologically.
  const chartData = (() => {
    if (!rows?.length) return [];
    return [...rows]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => {
        const parsed = new Date(r.date);
        const label = isNaN(parsed.getTime()) ? r.date : format(parsed, 'd MMM', { locale: dateLocale });
        return {
          date: label,
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
        };
      });
  })();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t('adminCampaignAnalytics.title')}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Target info */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
              {campaign.doctor ? (
                <>
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={campaign.doctor.profiles?.avatar_url} />
                    <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground">{campaign.doctor.profiles?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{campaign.doctor.specialty}</p>
                  </div>
                </>
              ) : campaign.clinic ? (
                <>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{campaign.clinic.name}</p>
                    <p className="text-sm text-muted-foreground">{t('adminCampaignAnalytics.clinicLabel')}</p>
                  </div>
                </>
              ) : null}
              <div className="ml-auto text-right">
                <Badge variant="outline">{campaign.package?.name}</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(campaign.start_date), 'd MMM', { locale: dateLocale })} — {format(new Date(campaign.end_date), 'd MMM yyyy', { locale: dateLocale })}
                </p>
              </div>
            </div>

            {/* Stats grid — only impressions/clicks are tracked by the backend */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-500 mb-2">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs font-medium">{t('adminCampaignAnalytics.statImpressions')}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.impressions.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-500 mb-2">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-xs font-medium">{t('adminCampaignAnalytics.statClicks')}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.clicks.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t('adminCampaignAnalytics.statCtr')}{ctr}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">{t('adminCampaignAnalytics.chartTitle')}</h3>
                  <div className="h-64">
                    <Suspense fallback={<Skeleton className="h-full w-full" />}>
                      <CampaignPerformanceChart
                        data={chartData}
                        impressionsLabel={t('adminCampaignAnalytics.statImpressions')}
                        clicksLabel={t('adminCampaignAnalytics.statClicks')}
                      />
                    </Suspense>
                  </div>
                </CardContent>
              </Card>
            )}

            {(!rows || rows.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                {t('adminCampaignAnalytics.noData')}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
