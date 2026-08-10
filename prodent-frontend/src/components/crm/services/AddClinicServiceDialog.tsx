import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  createClinicService,
  invalidateClinicServiceQueries,
  updateClinicService,
  type ClinicService,
  type ClinicServiceWriteInput,
} from '@/lib/clinic-service-management-api';

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
    is_active?: boolean | null;
    canonical?: ClinicService;
  } | null;
  categories: string[];
}

export function AddClinicServiceDialog({
  open,
  onOpenChange,
  clinicId,
  editService,
  categories
}: AddClinicServiceDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { canEdit } = useModulePermissions();

  const defaultCategories = useMemo(() => [
    t('crmServiceDialogs.catConsultation'),
    t('crmServiceDialogs.catDiagnostics'),
    t('crmServiceDialogs.catTherapy'),
    t('crmServiceDialogs.catSurgery'),
    t('crmServiceDialogs.catProsthetics'),
    t('crmServiceDialogs.catOrthodontics'),
    t('crmServiceDialogs.catImplantation'),
    t('crmServiceDialogs.catAesthetics'),
    t('crmServiceDialogs.catPrevention'),
    t('crmServiceDialogs.catPediatric'),
    t('crmServiceDialogs.catOther'),
  ], [t]);

  const defaultCategory = t('crmServiceDialogs.catConsultation');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [price, setPrice] = useState('');
  const [displayPrice, setDisplayPrice] = useState('');
  const [duration, setDuration] = useState('30');
  const [currency, setCurrency] = useState<'UZS' | 'USD'>('UZS');

  const allCategories = [...new Set([...defaultCategories, ...categories])];

  const formatNumberInput = (value: string) => {
    const normalized = value.replace(/\s/g, '').replace(',', '.');
    const [integer = '', fraction] = normalized.split('.');
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\s/g, '').replace(',', '.');
    if (raw === '' || /^\d+(\.\d{0,2})?$/.test(raw)) {
      setPrice(raw);
      setDisplayPrice(formatNumberInput(raw));
    }
  };

  useEffect(() => {
    if (editService) {
      setName(editService.name || '');
      setDescription(editService.description || '');
      setCategory(editService.category || defaultCategory);
      setPrice(editService.price?.toString() || '');
      setDisplayPrice(formatNumberInput(editService.price?.toString() || ''));
      setDuration(editService.duration_minutes?.toString() || '30');
      setCurrency((editService.currency as 'UZS' | 'USD') || 'UZS');
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editService, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory(defaultCategory);
    setPrice('');
    setDisplayPrice('');
    setDuration('30');
    setCurrency('UZS');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canEdit('services')) throw new Error(t('crm.accessDenied'));
      // Resolve clinic id — fall back to looking up doctor's clinic if context
      // hasn't populated yet.
      let cid = clinicId;
      if (!cid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          const { data: doctor } = await supabase
            .from('doctors')
            .select('clinic_id')
            .eq('user_id', user.id)
            .maybeSingle();
          if (doctor?.clinic_id) cid = doctor.clinic_id;
        }
      }
      if (!cid) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      if (!name.trim()) throw new Error(t('crmServiceDialogs.enterServiceName'));
      const priceNum = Number(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) throw new Error(t('crmServiceDialogs.enterValidPrice'));

      const previous = editService?.canonical;
      const serviceData: ClinicServiceWriteInput = {
        nameRu: name.trim(),
        nameUz: previous?.nameUz,
        nameUzCyrl: previous?.nameUzCyrl,
        nameKz: previous?.nameKz,
        nameKg: previous?.nameKg,
        nameTj: previous?.nameTj,
        descriptionRu: description || null,
        descriptionUz: previous?.descriptionUz,
        descriptionUzCyrl: previous?.descriptionUzCyrl,
        descriptionKz: previous?.descriptionKz,
        descriptionKg: previous?.descriptionKg,
        descriptionTj: previous?.descriptionTj,
        category,
        price: priceNum,
        duration: parseInt(duration, 10) || 30,
        currency: currency as 'UZS' | 'USD',
        isActive: previous?.isActive ?? editService?.is_active ?? true,
      };

      if (editService) {
        await updateClinicService(cid, editService.id, serviceData);
      } else {
        await createClinicService(cid, serviceData);
      }
    },
    onSuccess: () => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(editService ? t('crmServiceDialogs.serviceUpdated') : t('crmServiceDialogs.serviceAdded'));
      handleClose();
    },
    onError: (error: Error) => {
      console.error('Error saving service:', error);
      toast.error(error.message || t('crmServiceDialogs.saveError'));
    },
  });

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const parsedPrice = Number(price);
  const canSubmit = Boolean(
    name.trim()
    && price !== ''
    && Number.isFinite(parsedPrice)
    && parsedPrice >= 0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {editService ? t('crmServiceDialogs.editService') : t('crmServiceDialogs.newService')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="add-clinic-service-dialog-field-1">{t('crmServiceDialogs.serviceName')} *</Label>
            <Input id="add-clinic-service-dialog-field-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('crmServiceDialogs.serviceNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('crmServiceDialogs.serviceCategory')}</Label>
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
              <Label htmlFor="add-clinic-service-dialog-field-2">{t('crmServiceDialogs.servicePrice')} *</Label>
              <Input id="add-clinic-service-dialog-field-2"
                value={displayPrice}
                onChange={handlePriceChange}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-transparent select-none">.</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'UZS' | 'USD')}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UZS">{t('crmServiceDialogs.currencySom')}</SelectItem>
                  <SelectItem value="USD">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-clinic-service-dialog-field-3">{t('crmServiceDialogs.serviceDuration')}</Label>
              <Input id="add-clinic-service-dialog-field-3"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min="5"
                step="5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-clinic-service-dialog-field-4">{t('crmServiceDialogs.serviceDescription')}</Label>
            <Textarea id="add-clinic-service-dialog-field-4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('crmServiceDialogs.serviceDescriptionPlaceholder')}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSubmit || saveMutation.isPending}
              className="flex-1"
            >
              {saveMutation.isPending ? t('crmServiceDialogs.saving') : (editService ? t('common.save') : t('common.add'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
