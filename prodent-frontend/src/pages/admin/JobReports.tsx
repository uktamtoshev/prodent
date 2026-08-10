import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { jobs } from '@/lib/jobs';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flag, Check, X, Loader2 } from 'lucide-react';
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

const STATUS_KEYS = ['open', 'reviewed', 'dismissed'] as const;
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  open: 'destructive',
  reviewed: 'default',
};

interface JobReport {
  id: string;
  target_type: 'resume' | 'listing';
  reason: string;
  status: string;
  created_at: string | null;
}

export default function JobReports() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('open');
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const STATUS_LABEL = useMemo(
    () => Object.fromEntries(STATUS_KEYS.map((k) => [k, t(`adminJobReports.st_${k}`)])) as Record<string, string>,
    [t],
  );

  const { data: reports, isLoading, isError } = useQuery({
    queryKey: ['admin-job-reports', status],
    queryFn: async () => (await jobs.listReports(status === 'all' ? undefined : status)) as JobReport[],
  });

  const resolve = useMutation({
    mutationFn: ({ id, to, reason }: { id: string; to: 'reviewed' | 'dismissed'; reason: string }) =>
      jobs.resolveReport(id, to, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-job-reports'] });
      queryClient.invalidateQueries({ queryKey: ['open-job-reports-count'] });
      toast.success(t('adminJobReports.saved'));
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t('admin.actionError')),
  });

  const list = useMemo(() => reports || [], [reports]);
  const decide = (id: string, to: 'reviewed' | 'dismissed') => {
    const reason = window.prompt(`${t('adminJobReports.colReason')}:`)?.trim();
    if (!reason) {
      toast.error(t('admin.actionError'));
      return;
    }
    resolve.mutate({ id, to, reason });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Flag className="h-7 w-7" /> {t('adminJobReports.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminJobReports.subtitle')}</p>
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminJobReports.allStatuses')}</SelectItem>
              <SelectItem value="open">{STATUS_LABEL.open}</SelectItem>
              <SelectItem value="reviewed">{STATUS_LABEL.reviewed}</SelectItem>
              <SelectItem value="dismissed">{STATUS_LABEL.dismissed}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminJobReports.colTarget')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminJobReports.colReason')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminJobReports.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminJobReports.colDate')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('admin.actions')}</TableHead>
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
                    {t('adminJobReports.loadError')}
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminJobReports.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => (
                  <TableRow key={r.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <Badge variant="outline">
                        {r.target_type === 'resume' ? t('adminJobReports.targetResume') : t('adminJobReports.targetListing')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-foreground max-w-md">{r.reason}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[r.status] || 'secondary'}>
                        {STATUS_LABEL[r.status] || r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString(dateLocale) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'open' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            disabled={resolve.isPending}
                            onClick={() => decide(r.id, 'reviewed')}
                          >
                            {resolve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {t('adminJobReports.markReviewed')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-muted-foreground"
                            disabled={resolve.isPending}
                            onClick={() => decide(r.id, 'dismissed')}
                          >
                            <X className="h-3.5 w-3.5" />
                            {t('adminJobReports.dismiss')}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
