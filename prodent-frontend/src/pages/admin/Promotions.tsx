import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Plus, Megaphone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PromotionStats } from '@/components/admin/promotions/PromotionStats';
import { PromotionFormDialog } from '@/components/admin/promotions/PromotionFormDialog';
import { PromotionList } from '@/components/admin/promotions/PromotionList';

export default function AdminPromotions() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const queryClient = useQueryClient();

  const expireOutdatedMutation = useMutation({
    mutationFn: async () => {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('promotions')
        .update({ status: 'EXPIRED', active: false })
        .lt('valid_until', nowIso)
        .eq('status', 'ACTIVE');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions-stats'] });
      toast.success('Истёкшие акции переведены в статус EXPIRED');
    },
    onError: (e: any) => toast.error('Ошибка: ' + e.message),
  });

  const handleEdit = (promo: any) => {
    setEditingId(promo.id);
    setEditingData(promo);
    setOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setEditingData(null);
    setOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Megaphone className="h-7 w-7 text-cyan-400" />
              Акции
            </h1>
            <p className="text-slate-400 mt-2 max-w-2xl">
              Полноценная рекламная система: акции отображаются на главной странице как премиум-предложения,
              привязываются к клиникам и врачам, поддерживают таргетинг по городам, мультиязычный контент,
              приоритезацию и аналитику показов / кликов.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={() => expireOutdatedMutation.mutate()}
              disabled={expireOutdatedMutation.isPending}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Закрыть истёкшие
            </Button>
            <Button
              onClick={handleNew}
              className="bg-cyan-500 hover:bg-cyan-500/90 text-black gap-2"
            >
              <Plus className="h-4 w-4" />
              Создать акцию
            </Button>
          </div>
        </div>

        <PromotionStats />

        <PromotionList onEdit={handleEdit} />

        <PromotionFormDialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) {
              setEditingId(null);
              setEditingData(null);
            }
          }}
          editingId={editingId}
          initialData={editingData}
        />
      </div>
    </AdminLayout>
  );
}
