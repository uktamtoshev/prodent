import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Promo() {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: promoCodes, isLoading } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('promo_codes').insert({
        code: code.toUpperCase(),
        discount_percent: parseInt(discountPercent),
        max_uses: parseInt(maxUses),
        description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Промокод создан');
      setIsOpen(false);
      setCode('');
      setDiscountPercent('');
      setMaxUses('');
      setDescription('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promo_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success('Промокод удалён');
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Промокоды и акции</h1>
            <p className="text-slate-400 mt-2">Управление скидками и спецпредложениями</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#00C6BB] hover:bg-[#00C6BB]/90">
                <Plus className="h-4 w-4" />
                Создать промокод
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white">
              <DialogHeader>
                <DialogTitle>Новый промокод</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">Код</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="PRO2025"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Скидка %</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="50"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label htmlFor="maxUses">Максимум использований</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Скидка 50% на год"
                    className="bg-slate-800 border-slate-700"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="w-full bg-[#00C6BB] hover:bg-[#00C6BB]/90"
                >
                  Создать
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Код</TableHead>
                <TableHead className="text-slate-400">Скидка</TableHead>
                <TableHead className="text-slate-400">Использовано</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
                <TableHead className="text-slate-400">Описание</TableHead>
                <TableHead className="text-slate-400">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : promoCodes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400">
                    Промокоды не найдены
                  </TableCell>
                </TableRow>
              ) : (
                promoCodes?.map((promo) => (
                  <TableRow key={promo.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="text-white font-mono font-bold">{promo.code}</TableCell>
                    <TableCell className="text-white">{promo.discount_percent}%</TableCell>
                    <TableCell className="text-slate-300">
                      {promo.current_uses} / {promo.max_uses || '∞'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.active ? 'default' : 'secondary'}>
                        {promo.active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">{promo.description || 'N/A'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => deleteMutation.mutate(promo.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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