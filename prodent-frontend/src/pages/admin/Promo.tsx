import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { useLanguage } from '@/contexts/LanguageContext';

export default function Promo() {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [description, setDescription] = useState('');
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: promoCodes, isLoading, error: listError } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const discountValue = parseInt(discountPercent, 10);
      if (!discountPercent.trim() || Number.isNaN(discountValue)) {
        throw new Error(t('adminPromo.invalidDiscount'));
      }
      const { error } = await supabase.from('promo_codes').insert({
        code: code.toUpperCase(),
        discount_type: 'PERCENT',
        discount_value: discountValue,
        max_uses: maxUses ? parseInt(maxUses) : null,
        description,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success(t('adminPromo.created'));
      setIsOpen(false);
      setCode('');
      setDiscountPercent('');
      setMaxUses('');
      setDescription('');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('adminPromo.error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promo_codes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promo-codes'] });
      toast.success(t('adminPromo.deleted'));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('adminPromo.error'));
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('adminPromo.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('adminPromo.subtitle')}</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#00C6BB] hover:bg-[#00C6BB]/90">
                <Plus className="h-4 w-4" />
                {t('adminPromo.createBtn')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle>{t('adminPromo.newDialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="code">{t('adminPromo.labelCode')}</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="PRO2025"
                    className="bg-muted border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="discount">{t('adminPromo.labelDiscount')}</Label>
                  <Input
                    id="discount"
                    type="number"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    placeholder="50"
                    className="bg-muted border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="maxUses">{t('adminPromo.labelMaxUses')}</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder="100"
                    className="bg-muted border-border"
                  />
                </div>
                <div>
                  <Label htmlFor="description">{t('adminPromo.labelDescription')}</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('adminPromo.placeholderDescription')}
                    className="bg-muted border-border"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="w-full bg-[#00C6BB] hover:bg-[#00C6BB]/90"
                >
                  {t('admin.create')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminPromo.colCode')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromo.colDiscount')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromo.colUsed')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromo.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromo.colDescription')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromo.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : listError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-red-400">
                    {t('adminPromo.loadError') + (listError instanceof Error ? listError.message : '')}
                  </TableCell>
                </TableRow>
              ) : promoCodes?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {t('adminPromo.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                promoCodes?.map((promo) => (
                  <TableRow key={promo.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground font-mono font-bold">{promo.code}</TableCell>
                    <TableCell className="text-foreground">{promo.discount_value}%</TableCell>
                    <TableCell className="text-muted-foreground">
                      {promo.current_uses} / {promo.max_uses || '∞'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={promo.is_active ? 'default' : 'secondary'}>
                        {promo.is_active ? t('adminPromo.statusActive') : t('adminPromo.statusInactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{promo.description || 'N/A'}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (window.confirm(t('adminPromo.confirmDelete'))) {
                            deleteMutation.mutate(promo.id);
                          }
                        }}
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
