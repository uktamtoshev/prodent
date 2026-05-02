import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface AddClinicServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId?: string;
  editService?: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    duration_minutes: number | null;
    currency?: string;
  } | null;
  categories: string[];
}

const defaultCategories = [
  'Консультация',
  'Диагностика',
  'Терапия',
  'Хирургия',
  'Ортопедия',
  'Ортодонтия',
  'Имплантация',
  'Эстетика',
  'Профилактика',
  'Детская стоматология',
  'Другие услуги'
];

export function AddClinicServiceDialog({ 
  open, 
  onOpenChange, 
  clinicId, 
  editService,
  categories 
}: AddClinicServiceDialogProps) {
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Консультация');
  const [price, setPrice] = useState('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');

  const allCategories = [...new Set([...defaultCategories, ...categories])];

  const formatNumberInput = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '');
    if (raw === '' || /^\d+$/.test(raw)) {
      setPrice(raw);
      setDisplayPrice(formatNumberInput(raw));
    }
  };

  useEffect(() => {
    if (editService) {
      setName(editService.name || '');
      setDescription(editService.description || '');
      setCategory(editService.category || 'Консультация');
      setPrice(editService.price?.toString() || '');
      setDisplayPrice(formatNumberInput(editService.price?.toString() || ''));
      setDuration(editService.duration_minutes?.toString() || '30');
      setCurrency((editService.currency as 'UZS' | 'USD') || 'UZS');
    } else {
      resetForm();
    }
  }, [editService, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('Консультация');
    setPrice('');
    setDisplayPrice('');
    setDuration('30');
    setCurrency('UZS');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinicId) throw new Error('Clinic not selected');

      const serviceData = {
        name,
        description: description || null,
        category,
        price: parseInt(price),
        duration_minutes: parseInt(duration) || 30,
        currency,
      };

      if (editService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert({
            ...serviceData,
            clinic_id: clinicId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(editService ? 'Услуга обновлена' : 'Услуга добавлена');
      handleClose();
    },
    onError: (error) => {
      console.error('Error saving service:', error);
      toast.error('Ошибка при сохранении');
    },
  });

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const canSubmit = name.trim() && price !== '' && parseInt(price) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {editService ? 'Редактировать услугу' : 'Новая услуга'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Название *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Консультация стоматолога"
            />
          </div>

          <div className="space-y-2">
            <Label>Категория</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <div className="space-y-2">
              <Label>Цена *</Label>
              <Input
                value={displayPrice}
                onChange={handlePriceChange}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-transparent select-none">В</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'UZS' | 'USD')}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">сум</SelectItem>
                  <SelectItem value="USD">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Длительность (мин)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="5"
                step="5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание услуги..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Отмена
            </Button>
            <Button 
              onClick={() => saveMutation.mutate()} 
              disabled={!canSubmit || saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? 'Сохранение...' : (editService ? 'Сохранить' : 'Добавить')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}