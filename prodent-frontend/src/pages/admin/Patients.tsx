import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchSupportPatients } from '@/lib/adminSupport';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';

const PAGE_SIZE = 25;

export default function Patients() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [reason, setReason] = useState('');
  const [appliedReason, setAppliedReason] = useState('');
  const [page, setPage] = useState(0);
  const { t } = useLanguage();

  useEffect(() => {
    setPage(0);
  }, [appliedSearch, appliedReason]);

  const { data: patientPage, isLoading, isError } = useQuery({
    queryKey: ['admin-patients', appliedSearch, appliedReason, page],
    queryFn: () => searchSupportPatients({
      query: appliedSearch,
      reason: appliedReason,
      page,
      size: PAGE_SIZE,
    }),
    enabled: Boolean(appliedReason),
  });
  const patients = patientPage?.content ?? [];
  const totalPages = Math.max(1, patientPage?.totalPages ?? 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('adminPatients.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('adminPatients.subtitle')}</p>
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminPatients.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Input
            placeholder="Причина обращения (обязательно)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            disabled={!reason.trim()}
            onClick={() => {
              setPage(0);
              setAppliedSearch(search.trim());
              setAppliedReason(reason.trim());
            }}
          >
            Найти безопасно
          </Button>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminPatients.colPatient')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPatients.colPhone')}</TableHead>
                <TableHead className="text-muted-foreground">Статус аккаунта</TableHead>
                <TableHead className="text-muted-foreground">Проверен</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPatients.colRegDate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!appliedReason ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Укажите причину обращения, чтобы начать безопасный поиск.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-destructive">
                    Не удалось загрузить список пациентов
                  </TableCell>
                </TableRow>
              ) : patients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminPatients.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                patients?.map((patient) => (
                  <TableRow key={patient.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <div className="font-medium text-foreground">{patient.displayName || t('adminPatients.noName')}</div>
                      <div className="text-xs text-muted-foreground">{patient.maskedEmail || '—'}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{patient.maskedPhone || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{patient.active ? 'Активен' : 'Отключён'}</TableCell>
                    <TableCell className="text-muted-foreground">{patient.verified ? 'Да' : 'Нет'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(patient.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!isError && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              ←
            </Button>
            <span className="text-sm text-muted-foreground">{page + 1} / {totalPages}</span>
            <Button
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              →
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
