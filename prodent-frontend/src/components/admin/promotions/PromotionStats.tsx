import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tag, Eye, MousePointerClick, AlertCircle, Pause } from 'lucide-react';

export function PromotionStats() {
  const { data } = useQuery({
    queryKey: ['admin-promotions-stats'],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('promotions')
        .select('status,impressions,clicks,bookings,active');
      const list = rows || [];
      const total = list.length;
      const active = list.filter((r: any) => r.status === 'ACTIVE' || r.active).length;
      const paused = list.filter((r: any) => r.status === 'PAUSED').length;
      const expired = list.filter((r: any) => r.status === 'EXPIRED').length;
      const impressions = list.reduce((s: number, r: any) => s + (Number(r.impressions) || 0), 0);
      const clicks = list.reduce((s: number, r: any) => s + (Number(r.clicks) || 0), 0);
      const bookings = list.reduce((s: number, r: any) => s + (Number(r.bookings) || 0), 0);
      const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : '0.00';
      return { total, active, paused, expired, impressions, clicks, bookings, ctr };
    },
    refetchInterval: 60_000,
  });

  const cards = [
    { label: 'Всего акций',  value: data?.total ?? 0,       icon: Tag,              color: 'text-cyan-400' },
    { label: 'Активных',     value: data?.active ?? 0,      icon: Tag,              color: 'text-green-400' },
    { label: 'На паузе',     value: data?.paused ?? 0,      icon: Pause,            color: 'text-yellow-400' },
    { label: 'Истёкших',     value: data?.expired ?? 0,     icon: AlertCircle,      color: 'text-red-400' },
    { label: 'Показов',      value: data?.impressions ?? 0, icon: Eye,              color: 'text-blue-400' },
    { label: 'Кликов',       value: data?.clicks ?? 0,      icon: MousePointerClick, color: 'text-purple-400' },
    { label: 'Записей',      value: data?.bookings ?? 0,    icon: Tag,              color: 'text-emerald-400' },
    { label: 'CTR',          value: `${data?.ctr ?? '0.00'}%`, icon: MousePointerClick, color: 'text-pink-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="bg-slate-900 border-slate-800 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">{c.label}</span>
            <c.icon className={`h-4 w-4 ${c.color}`} />
          </div>
          <div className="text-2xl font-bold text-white">{c.value}</div>
        </Card>
      ))}
    </div>
  );
}
