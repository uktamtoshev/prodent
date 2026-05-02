import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function Payments() {
  const { data: invoices, isLoading } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('id, total_amount, final_amount, currency, payment_method, status, invoice_number, notes, created_at, patient_id, doctor_id, clinic_id')
        .order('created_at', { ascending: false });
      
      if (!data) return [];
      
      // Fetch patient profiles
      const patientIds = data.map(i => i.patient_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', patientIds);
      
      // Fetch clinics
      const clinicIds = data.map(i => i.clinic_id).filter(Boolean);
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, name')
        .in('id', clinicIds);
      
      return data.map(invoice => ({
        ...invoice,
        patient: profiles?.find(p => p.id === invoice.patient_id),
        clinic: clinics?.find(c => c.id === invoice.clinic_id)
      }));
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/10 text-green-400 border-green-400/20';
      case 'partial': return 'bg-yellow-500/10 text-yellow-400 border-yellow-400/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-400/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-400/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Оплачено';
      case 'partial': return 'Частично';
      case 'cancelled': return 'Отменено';
      case 'new': return 'Новый';
      default: return status;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Счета и платежи</h1>
          <p className="text-slate-400 mt-2">Все счета по клиникам</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Дата</TableHead>
                <TableHead className="text-slate-400">№ счета</TableHead>
                <TableHead className="text-slate-400">Пациент</TableHead>
                <TableHead className="text-slate-400">Клиника</TableHead>
                <TableHead className="text-slate-400">Сумма</TableHead>
                <TableHead className="text-slate-400">Метод</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : invoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400">
                    Счета не найдены
                  </TableCell>
                </TableRow>
              ) : (
                invoices?.map((invoice) => (
                  <TableRow key={invoice.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-slate-300">
                      {new Date(invoice.created_at!).toLocaleString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-xs">
                      {invoice.invoice_number || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-white font-medium">{invoice.patient?.full_name || 'N/A'}</p>
                        <p className="text-sm text-slate-400">{invoice.patient?.phone || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {invoice.clinic?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-white font-semibold">
                      {(invoice.final_amount || invoice.total_amount || 0).toLocaleString()} {invoice.currency || 'UZS'}
                    </TableCell>
                    <TableCell className="text-slate-300 capitalize">
                      {invoice.payment_method || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status || 'new')}>
                        {getStatusText(invoice.status || 'new')}
                      </Badge>
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
