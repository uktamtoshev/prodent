import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format, subDays, eachDayOfInterval, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Eye, MousePointer, UserPlus, Calendar, TrendingUp, BarChart3, Building2, User } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

interface AnalyticsEvent {
  id: string;
  event_type: string;
  created_at: string;
  page_url: string | null;
  referrer_url: string | null;
}

export function CampaignAnalyticsDialog({ campaignId, isOpen, onClose, campaign }: CampaignAnalyticsDialogProps) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['campaign-analytics-detail', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_analytics')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AnalyticsEvent[];
    },
    enabled: isOpen
  });

  // Calculate stats
  const stats = {
    impressions: events?.filter(e => e.event_type === 'impression').length || 0,
    clicks: events?.filter(e => e.event_type === 'click').length || 0,
    profile_views: events?.filter(e => e.event_type === 'profile_view').length || 0,
    appointments: events?.filter(e => e.event_type === 'appointment_booking').length || 0,
  };

  const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(2) : '0';
  const conversionRate = stats.profile_views > 0 ? ((stats.appointments / stats.profile_views) * 100).toFixed(2) : '0';

  // Prepare chart data - last 14 days
  const chartData = (() => {
    if (!events?.length) return [];
    
    const endDate = new Date();
    const startDate = subDays(endDate, 13);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      
      const dayEvents = events.filter(e => {
        const eventDate = new Date(e.created_at);
        return eventDate >= dayStart && eventDate < dayEnd;
      });
      
      return {
        date: format(day, 'd MMM', { locale: ru }),
        impressions: dayEvents.filter(e => e.event_type === 'impression').length,
        clicks: dayEvents.filter(e => e.event_type === 'click').length,
        profile_views: dayEvents.filter(e => e.event_type === 'profile_view').length,
        appointments: dayEvents.filter(e => e.event_type === 'appointment_booking').length,
      };
    });
  })();

  // Top referrers
  const referrers = (() => {
    if (!events?.length) return [];
    const refMap = new Map<string, number>();
    events.forEach(e => {
      if (e.referrer_url) {
        try {
          const url = new URL(e.referrer_url);
          const domain = url.hostname;
          refMap.set(domain, (refMap.get(domain) || 0) + 1);
        } catch {
          refMap.set(e.referrer_url, (refMap.get(e.referrer_url) || 0) + 1);
        }
      }
    });
    return Array.from(refMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  })();

  const targetName = campaign.doctor?.profiles?.full_name || campaign.clinic?.name || 'Неизвестно';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            Аналитика кампании
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
                    <p className="text-sm text-muted-foreground">Клиника</p>
                  </div>
                </>
              ) : null}
              <div className="ml-auto text-right">
                <Badge variant="outline">{campaign.package?.name}</Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(campaign.start_date), 'd MMM', { locale: ru })} — {format(new Date(campaign.end_date), 'd MMM yyyy', { locale: ru })}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-blue-500/10 border-blue-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-blue-500 mb-2">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs font-medium">Показы</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.impressions.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-green-500 mb-2">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-xs font-medium">Клики</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.clicks.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">CTR: {ctr}%</p>
                </CardContent>
              </Card>

              <Card className="bg-purple-500/10 border-purple-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-500 mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs font-medium">Просмотры профиля</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.profile_views.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card className="bg-orange-500/10 border-orange-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-orange-500 mb-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-xs font-medium">Записи</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{stats.appointments.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Конверсия: {conversionRate}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">Динамика за 14 дней</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="impressions" 
                          name="Показы"
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorImpressions)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="clicks" 
                          name="Клики"
                          stroke="#22c55e" 
                          fillOpacity={1} 
                          fill="url(#colorClicks)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Referrers */}
            {referrers.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">Источники трафика</h3>
                  <div className="space-y-2">
                    {referrers.map(ref => (
                      <div key={ref.domain} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <span className="text-sm text-foreground">{ref.domain}</span>
                        <Badge variant="secondary">{ref.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent events */}
            {events && events.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold mb-4 text-foreground">Последние события</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {events.slice(0, 20).map(event => (
                      <div key={event.id} className="flex items-center justify-between py-2 text-sm border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {event.event_type === 'impression' && 'Показ'}
                            {event.event_type === 'click' && 'Клик'}
                            {event.event_type === 'profile_view' && 'Просмотр'}
                            {event.event_type === 'appointment_booking' && 'Запись'}
                          </Badge>
                          {event.page_url && (
                            <span className="text-muted-foreground text-xs truncate max-w-48">
                              {event.page_url}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.created_at), 'd MMM HH:mm', { locale: ru })}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {events?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Нет данных аналитики для этой кампании
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
