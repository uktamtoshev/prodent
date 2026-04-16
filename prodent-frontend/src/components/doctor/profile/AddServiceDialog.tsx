import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  editService?: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number;
    duration_minutes: number | null;
    currency?: string;
  } | null;
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

export function AddServiceDialog({ open, onOpenChange, doctorId, editService }: AddServiceDialogProps) {
  const queryClient = useQueryClient();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Консультация');
  const [price, setPrice] = useState('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');

  // Format number with spaces
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

  // Update form when editService changes
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
  }, [editService]);

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
      if (editService) {
        const { error } = await supabase
          .from('doctor_services')
          .update({
            name,
            description: description || null,
            category,
            price: parseInt(price),
            duration_minutes: parseInt(duration) || 30,
            currency,
          })
          .eq('id', editService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('doctor_services')
          .insert({
            doctor_id: doctorId,
            name,
            description: description || null,
            category,
            price: parseInt(price),
            duration_minutes: parseInt(duration) || 30,
            currency,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-services', doctorId] });
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editService ? 'Редактировать услугу' : 'Добавить услугу'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Название услуги *</Label>
            <Input
              placeholder="Например: Консультация, Чистка зубов..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Категория *</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {defaultCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Цена *</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                placeholder={currency === 'UZS' ? '100 000' : '50'}
                value={displayPrice}
                onChange={handlePriceChange}
                className="flex-1"
              />
              <div className="flex rounded-md border border-input overflow-hidden">
                <button
                  type="button"
                  onClick={() => setCurrency('UZS')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    currency === 'UZS' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  сум
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  className={`px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                    currency === 'USD' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Длительность (мин)</Label>
            <Input
              type="number"
              placeholder="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              placeholder="Краткое описание услуги..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
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