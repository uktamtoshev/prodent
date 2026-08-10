import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Gift, Download } from 'lucide-react';
import { exportToCsv } from '@/lib/csv';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

const STATUS_KEYS = ['PENDING', 'CREDITED', 'EXPIRED'] as const;
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  CREDITED: 'default',
  EXPIRED: 'destructive',
};

interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  bonus_amount: number | string;
  currency: string;
  status: string;
  credited_at: string | null;
  created_at: string | null;
}

interface ReferralBonus extends ReferralRow {
  referrerName: string | null;
  referredName: string | null;
}

interface ReferralProfile { id: string; full_name: string | null }

export default function Referrals() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const STATUS_LABEL = useMemo(
    () => Object.fromEntries(STATUS_KEYS.map((k) => [k, t(`adminReferrals.st_${k}`)])) as Record<string, string>,
    [t],
  );

  const { data: bonuses, isLoading, isError } = useQuery({
    // Admin-only read (backend ADMIN_ONLY_TABLES). Financial accruals — read-only here;
    // status changes are money ops and require a dedicated audited endpoint (not the proxy).
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('referral_bonuses')
        .select('id, referrer_id, referred_id, bonus_amount, currency, status, credited_at, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const referralRows = (rows || []) as ReferralRow[];
      if (referralRows.length === 0) return [] as ReferralBonus[];

      const userIds = [
        ...new Set(referralRows.flatMap((row) => [row.referrer_id, row.referred_id]).filter(Boolean)),
      ];
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
        : { data: [] as ReferralProfile[] };
      const name = new Map(((profiles || []) as ReferralProfile[]).map((profile) => [profile.id, profile.full_name]));

      return referralRows.map((row): ReferralBonus => ({
        ...row,
        referrerName: name.get(row.referrer_id) || null,
        referredName: name.get(row.referred_id) || null,
      }));
    },
  });

  const filtered = useMemo(() => {
    let list = bonuses || [];
    if (status !== 'all') list = list.filter((bonus) => bonus.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((bonus) =>
        [bonus.referrerName, bonus.referredName].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [bonuses, status, search]);

  const kpi = useMemo(() => {
    const list = bonuses || [];
    const sum = (s: string) =>
      list.filter((bonus) => bonus.status === s).reduce((sum, bonus) => sum + (Number(bonus.bonus_amount) || 0), 0);
    return { pending: sum('PENDING'), credited: sum('CREDITED') };
  }, [bonuses]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Gift className="h-7 w-7" /> {t('adminReferrals.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminReferrals.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={!filtered.length}
            onClick={() =>
              exportToCsv(
                'referrals',
                [t('adminReferrals.colReferrer'), t('adminReferrals.colReferred'), t('adminReferrals.colAmount'), t('adminReferrals.colStatus'), t('adminReferrals.colDate')],
                filtered.map((b) => [b.referrerName, b.referredName, b.bonus_amount, STATUS_LABEL[b.status] || b.status, b.created_at]),
              )
            }
          >
            <Download className="h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('adminReferrals.kpiPending')}</p>
            <p className="text-2xl font-bold text-foreground">{formatPrice(kpi.pending)}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('adminReferrals.kpiCredited')}</p>
            <p className="text-2xl font-bold text-foreground">{formatPrice(kpi.credited)}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminReferrals.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminReferrals.allStatuses')}</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminReferrals.colReferrer')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReferrals.colReferred')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('adminReferrals.colAmount')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReferrals.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminReferrals.colDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminReferrals.loadError')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminReferrals.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground">{b.referrerName || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{b.referredName || '—'}</TableCell>
                    <TableCell className="text-right text-foreground">{formatPrice(Number(b.bonus_amount) || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[b.status] || 'secondary'}>
                        {STATUS_LABEL[b.status] || b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.created_at ? new Date(b.created_at).toLocaleDateString(dateLocale) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
