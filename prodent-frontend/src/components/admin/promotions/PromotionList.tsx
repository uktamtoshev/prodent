import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Pencil,
  Trash2,
  MoreVertical,
  Building2,
  User,
  Eye,
  MousePointerClick,
  Calendar,
  Image as ImageIcon,
  Search,
  Star,
  Play,
  Pause,
  Archive,
} from 'lucide-react';
import { PROMOTION_CATEGORIES, STATUS_OPTIONS } from './PromotionFormDialog';
import { cn } from '@/lib/utils';

interface Props {
  onEdit: (promo: any) => void;
}

export function PromotionList({ onEdit }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['admin-promotions', statusFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('promotions')
        .select(`
          *,
          clinic:clinics(id, name),
          doctor:doctors(id, user_id, profiles:user_id(full_name))
        `)
        .order('is_featured', { ascending: false })
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      if (categoryFilter !== 'all') query = query.eq('category', categoryFilter);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions-stats'] });
      toast.success('Акция удалена');
    },
    onError: (e: any) => toast.error('Ошибка: ' + e.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('promotions')
        .update({ status, active: status === 'ACTIVE' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions-stats'] });
      toast.success('Статус обновлён');
    },
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('promotions')
        .update({ is_featured: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
    },
  });

  const filtered = (promotions ?? []).filter((p: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.clinic?.name?.toLowerCase().includes(q) ||
      p.doctor?.profiles?.full_name?.toLowerCase().includes(q)
    );
  });

  const fmtPrice = (n: number, c = 'UZS') =>
    new Intl.NumberFormat('uz-UZ').format(n || 0) + ' ' + (c === 'UZS' ? 'сум' : c);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      return format(new Date(d), 'd MMM yyyy', { locale: ru });
    } catch {
      return d;
    }
  };

  const isExpired = (d: string) => new Date(d) < new Date();

  const statusBadge = (s: string, validUntil: string) => {
    const expired = isExpired(validUntil);
    const opt = STATUS_OPTIONS.find((o) => o.value === (expired ? 'EXPIRED' : s));
    return (
      <Badge className={cn('font-normal border', opt?.color ?? 'bg-slate-700')}>
        {opt?.label ?? s}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Поиск по названию, описанию, клинике, врачу…"
            className="pl-9 bg-slate-900 border-slate-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800">
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-52 bg-slate-900 border-slate-800">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 max-h-72">
            <SelectItem value="all">Все категории</SelectItem>
            {PROMOTION_CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-slate-800/40">
              <TableHead className="text-slate-400">Акция</TableHead>
              <TableHead className="text-slate-400">Категория</TableHead>
              <TableHead className="text-slate-400">Скидка / Цена</TableHead>
              <TableHead className="text-slate-400">Привязка</TableHead>
              <TableHead className="text-slate-400">Период</TableHead>
              <TableHead className="text-slate-400">Аналитика</TableHead>
              <TableHead className="text-slate-400">Статус</TableHead>
              <TableHead className="text-slate-400 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  Нет акций. Создайте первую.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p: any) => {
                const ctr =
                  p.impressions > 0 ? ((p.clicks || 0) * 100) / p.impressions : 0;
                return (
                  <TableRow key={p.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt=""
                            className="w-12 h-12 rounded object-cover border border-slate-700"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-slate-600" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate max-w-[220px]">
                              {p.title}
                            </span>
                            {p.is_featured && (
                              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            )}
                            {p.badge_label && (
                              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] py-0">
                                {p.badge_label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-slate-400 text-xs truncate max-w-[260px]">
                            {p.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-slate-300 border-slate-700">
                        {PROMOTION_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.discount > 0 && (
                          <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded text-xs font-bold">
                            -{p.discount}%
                          </span>
                        )}
                        <div>
                          <div className="text-white font-medium text-sm">
                            {fmtPrice(p.price, p.currency)}
                          </div>
                          {p.old_price > 0 && (
                            <div className="text-slate-500 text-xs line-through">
                              {fmtPrice(p.old_price, p.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-sm">
                        {p.clinic && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <Building2 className="h-3 w-3 text-cyan-400" />
                            <span className="truncate max-w-[180px]">{p.clinic.name}</span>
                          </div>
                        )}
                        {p.doctor && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <User className="h-3 w-3 text-purple-400" />
                            <span className="truncate max-w-[180px]">
                              {p.doctor.profiles?.full_name ?? 'Врач'}
                            </span>
                          </div>
                        )}
                        {!p.clinic && !p.doctor && <span className="text-slate-500">—</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-300">
                        <Calendar className="h-3.5 w-3.5" />
                        <div>
                          <div>{fmtDate(p.valid_from)} —</div>
                          <div
                            className={
                              isExpired(p.valid_until) ? 'text-red-400' : 'text-slate-300'
                            }
                          >
                            {fmtDate(p.valid_until)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-slate-300">
                        <span className="flex items-center gap-1" title="Показы">
                          <Eye className="h-3 w-3 text-blue-400" />
                          {p.impressions ?? 0}
                          {p.max_impressions && (
                            <span className="text-slate-500"> / {p.max_impressions}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-1" title="Клики">
                          <MousePointerClick className="h-3 w-3 text-purple-400" />
                          {p.clicks ?? 0}
                          <span className="text-slate-500 ml-1">CTR {ctr.toFixed(1)}%</span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(p.status ?? (p.active ? 'ACTIVE' : 'DRAFT'), p.valid_until)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                          <DropdownMenuItem onClick={() => onEdit(p)}>
                            <Pencil className="h-4 w-4 mr-2" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              toggleFeaturedMutation.mutate({ id: p.id, value: !p.is_featured })
                            }
                          >
                            <Star className="h-4 w-4 mr-2" />
                            {p.is_featured ? 'Снять Featured' : 'Сделать Featured'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {p.status !== 'ACTIVE' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'ACTIVE' })}
                            >
                              <Play className="h-4 w-4 mr-2" /> Активировать
                            </DropdownMenuItem>
                          )}
                          {p.status === 'ACTIVE' && (
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'PAUSED' })}
                            >
                              <Pause className="h-4 w-4 mr-2" /> Поставить на паузу
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => updateStatusMutation.mutate({ id: p.id, status: 'ARCHIVED' })}
                          >
                            <Archive className="h-4 w-4 mr-2" /> В архив
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => {
                              if (confirm(`Удалить акцию «${p.title}»? Это действие необратимо.`)) {
                                deleteMutation.mutate(p.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
