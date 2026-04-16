import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, TrendingUp, Calendar, Eye, MousePointer, Phone, Crown, Star } from "lucide-react";
import { useAdPackages, useAdCampaigns, useCampaignAnalytics } from "@/hooks/useAdCampaigns";
import { useClinic } from "@/contexts/ClinicContext";
import { format, differenceInDays, isPast } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from "@/lib/utils";

const packageTypeIcons: Record<string, React.ReactNode> = {
  top_day: <Star className="w-5 h-5" />,
  top_week: <TrendingUp className="w-5 h-5" />,
  top_month: <Crown className="w-5 h-5" />,
  banner: <Megaphone className="w-5 h-5" />,
};

const packageTypeLabels: Record<string, string> = {
  top_day: 'Топ дня',
  top_week: 'Топ недели',
  top_month: 'Топ месяца',
  banner: 'Баннер',
};

export default function Ads() {
  const { currentClinic } = useClinic();
  const { data: packages } = useAdPackages('clinic');
  const { data: campaigns } = useAdCampaigns();

  const myCampaigns = campaigns?.filter(c => c.clinic_id === currentClinic?.id) || [];
  const activeCampaigns = myCampaigns.filter(c => c.status === 'active');

  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground">Реклама на портале</h1>
          <p className="text-muted-foreground mt-1">Продвижение вашей клиники</p>
        </div>

        {/* Active Campaigns */}
        {activeCampaigns.length > 0 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Активные кампании
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeCampaigns.map((campaign) => {
                  const daysLeft = differenceInDays(new Date(campaign.end_date), new Date());
                  return (
                    <div key={campaign.id} className="flex items-center justify-between p-4 bg-background rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          {packageTypeIcons[campaign.package?.package_type || 'banner']}
                        </div>
                        <div>
                          <p className="font-medium">{campaign.package?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            до {format(new Date(campaign.end_date), 'd MMMM yyyy', { locale: ru })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className={cn(
                          daysLeft <= 3 ? "border-yellow-500 text-yellow-500" : "border-green-500 text-green-500"
                        )}>
                          {daysLeft} дн. осталось
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Packages */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Megaphone className="w-5 h-5" />
              Доступные пакеты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages?.map((pkg) => (
                <div 
                  key={pkg.id} 
                  className="p-6 rounded-xl border border-border/50 bg-gradient-to-br from-background to-muted/30 hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                      {packageTypeIcons[pkg.package_type]}
                    </div>
                    <div>
                      <h3 className="font-semibold">{pkg.name}</h3>
                      <p className="text-xs text-muted-foreground">{pkg.duration_days} дней</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{pkg.description}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{(pkg.price / 1000).toLocaleString()}K</p>
                      <p className="text-xs text-muted-foreground">{pkg.currency}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-6 bg-muted/50 rounded-xl text-center">
              <Phone className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Хотите разместить рекламу?</h3>
              <p className="text-muted-foreground mb-4">
                Свяжитесь с нашим менеджером для оформления рекламной кампании
              </p>
              <Button size="lg">
                <Phone className="w-4 h-4 mr-2" />
                Связаться с менеджером
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Campaign History */}
        {myCampaigns.length > 0 && (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                История кампаний
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">
                        {packageTypeLabels[campaign.package?.package_type || 'banner']}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(campaign.start_date), 'd MMM', { locale: ru })} — {format(new Date(campaign.end_date), 'd MMM yyyy', { locale: ru })}
                      </span>
                    </div>
                    <Badge className={cn(
                      campaign.status === 'active' ? 'bg-green-500/10 text-green-500' :
                      campaign.status === 'completed' ? 'bg-muted text-muted-foreground' :
                      'bg-yellow-500/10 text-yellow-500'
                    )}>
                      {campaign.status === 'active' ? 'Активна' : 
                       campaign.status === 'completed' ? 'Завершена' : 
                       campaign.status === 'cancelled' ? 'Отменена' : 'Ожидает'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </CRMLayout>
  );
}
