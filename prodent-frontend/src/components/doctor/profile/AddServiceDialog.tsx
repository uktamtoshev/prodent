import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { DollarSign } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  createDoctorService,
  invalidateDoctorServiceQueries,
  updateDoctorService,
} from '@/lib/doctor-services-api';

interface AddServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  editService?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    price: number;
    duration_minutes: number | null;
    currency?: string | null;
  } | null;
}

// Default category keys — we keep canonical Russian labels for DB persistence
// but translate them in the UI via t().
const DEFAULT_CATEGORY_KEYS: { value: string; key: string }[] = [
  { value: 'Консультация', key: 'crmServiceDialogs.catConsultation' },
  { value: 'Диагностика', key: 'crmServiceDialogs.catDiagnostics' },
  { value: 'Терапия', key: 'crmServiceDialogs.catTherapy' },
  { value: 'Хирургия', key: 'crmServiceDialogs.catSurgery' },
  { value: 'Ортопедия', key: 'crmServiceDialogs.catProsthetics' },
  { value: 'Ортодонтия', key: 'crmServiceDialogs.catOrthodontics' },
  { value: 'Имплантация', key: 'crmServiceDialogs.catImplantation' },
  { value: 'Эстетика', key: 'crmServiceDialogs.catAesthetics' },
  { value: 'Профилактика', key: 'crmServiceDialogs.catPrevention' },
  { value: 'Детская стоматология', key: 'crmServiceDialogs.catPediatric' },
  { value: 'Другие услуги', key: 'doctorAddService.catOther' },
];

export function AddServiceDialog({ open, onOpenChange, doctorId, editService }: AddServiceDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Консультация');
  const [price, setPrice] = useState('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');

  const localizedCategories = useMemo(
    () => DEFAULT_CATEGORY_KEYS.map((c) => ({ value: c.value, label: t(c.key) })),
    [t],
  );

  // Format number with spaces
  const formatNumberInput = (value: string) => {
    const [integer, fraction] = value.split('.');
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fraction === undefined ? formattedInteger : `${formattedInteger}.${fraction}`;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
    if (raw === '' || /^\d+(?:\.\d{0,2})?$/.test(raw)) {
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
      setCurrency(editService.currency === 'USD' ? 'USD' : 'UZS');
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
      const input = {
        name: name.trim(),
        description: description.trim() || null,
        category,
        price: Number(price),
        durationMinutes: Number(duration) || 30,
        currency,
      };

      if (editService) {
        return updateDoctorService(doctorId, editService.id, input);
      } else {
        return createDoctorService(doctorId, input);
      }
    },
    onSuccess: async () => {
      await invalidateDoctorServiceQueries(queryClient);
      toast.success(editService ? t('doctorAddSvcLocal.updated') : t('doctorAddSvcLocal.added'));
      handleClose();
    },
    onError: (error) => {
      console.error('Error saving service:', error);
      toast.error(t('doctorAddService.saveError'));
    },
  });

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const canSubmit = name.trim() && price !== '' && Number(price) >= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editService ? t('doctorAddService.editTitle') : t('doctorAddService.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-service-dialog-field-1">{t('doctorAddService.serviceName')} *</Label>
            <Input id="add-service-dialog-field-1"
              placeholder={t('doctorAddSvcLocal.serviceNamePh')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('doctorAddService.category')} *</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {localizedCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>{t('doctorAddSvcLocal.priceLabel')} *</Label>
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
                  {t('doctorAddSvcLocal.sumLabel')}
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
            <Label htmlFor="add-service-dialog-field-2">{t('doctorAddService.duration')}</Label>
            <Input id="add-service-dialog-field-2"
              type="number"
              placeholder="30"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-service-dialog-field-3">{t('doctorAddService.description')}</Label>
            <Textarea id="add-service-dialog-field-3"
              placeholder={t('doctorAddSvcLocal.descPh')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSubmit || saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? t('common.saving') : (editService ? t('common.save') : t('common.add'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
