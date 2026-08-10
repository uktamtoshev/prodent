import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, Eye, MousePointer, CalendarCheck } from 'lucide-react';
import { useAdCampaigns, useAllCampaignsAnalytics } from '@/hooks/useAdCampaigns';
import { useLanguage } from '@/contexts/LanguageContext';

export function AdsStats() {
  const { t } = useLanguage();
  const { data: campaigns } = useAdCampaigns();
  const { data: analytics } = useAllCampaignsAnalytics();

  const activeCampaigns = campaigns?.filter(c => c.status === 'active').length || 0;
  const totalRevenue = campaigns?.reduce((sum, c) => sum + c.amount_paid, 0) || 0;

  const totalStats = Object.values(analytics || {}).reduce(
    (acc, stats) => ({
      impressions: acc.impressions + stats.impressions,
      profile_views: acc.profile_views + stats.profile_views,
      banner_clicks: acc.banner_clicks + stats.banner_clicks,
      appointments: acc.appointments + stats.appointments_started,
    }),
    { impressions: 0, profile_views: 0, banner_clicks: 0, appointments: 0 }
  );

  const stats = [
    {
      title: t('adminAds.activeCampaigns'),
      value: activeCampaigns,
      icon: Calendar,
      color: 'text-green-500',
    },
    {
      title: t('adminAds.totalRevenue'),
      value: `${(totalRevenue / 1000000).toFixed(1)}M`,
      subtitle: 'UZS',
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      title: t('adminAds.totalImpressions'),
      value: totalStats.impressions.toLocaleString(),
      icon: Eye,
      color: 'text-blue-500',
    },
    {
      title: t('adminAds.totalClicks'),
      value: totalStats.banner_clicks.toLocaleString(),
      icon: MousePointer,
      color: 'text-orange-500',
    },
    {
      title: t('adminAds.totalAppointments'),
      value: totalStats.appointments,
      icon: CalendarCheck,
      color: 'text-teal-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stat.value}
              {stat.subtitle && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {stat.subtitle}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
