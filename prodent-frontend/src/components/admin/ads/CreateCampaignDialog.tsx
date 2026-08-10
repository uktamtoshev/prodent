import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Plus, Search } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAdPackages, useCreateCampaign } from '@/hooks/useAdCampaigns';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

// Token used by other REST helpers in the app (see useAdCampaigns.ts).
const TOKEN_KEY = 'prodent_access_token';
function adminAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

interface Props {
  children?: React.ReactNode;
}

interface CampaignTarget {
  id: string;
  name?: string;
  city?: string;
  specialty?: string;
  profiles?: { full_name?: string };
}

export function CreateCampaignDialog({ children }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<'doctor' | 'clinic'>('doctor');
  const [packageId, setPackageId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CampaignTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<CampaignTarget | null>(null);

  const { user } = useAuth();
  const { data: packages } = useAdPackages(targetType);
  const createCampaign = useCreateCampaign();

  const selectedPackage = packages?.find(p => p.id === packageId);
  const endDate = selectedPackage
    ? addDays(startDate, selectedPackage.duration_days)
    : startDate;

  // Search doctors or clinics via the REST search endpoints. Doctors use the
  // public endpoint; clinics use the authenticated one (admin is logged in).
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const search = async () => {
      try {
        if (targetType === 'doctor') {
          const res = await fetch(
            `/api/v1/public/doctors/search?query=${encodeURIComponent(searchQuery)}&size=10`,
            { signal: controller.signal },
          );
          if (!res.ok) { setSearchResults([]); return; }
          const page = await res.json();
          // Normalise DoctorResponse → the shape the rest of this component
          // expects (id, specialty, profiles.full_name).
          const items = (page?.content ?? []).map((d: {
            id: string;
            firstName?: string;
            lastName?: string;
            specialties?: Array<{ nameRu?: string; nameUz?: string }>;
          }) => ({
            id: d.id,
            specialty: d.specialties?.[0]?.nameRu ?? d.specialties?.[0]?.nameUz ?? '',
            profiles: { full_name: `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim() },
          }));
          setSearchResults(items);
        } else {
          const res = await fetch(
            `/api/v1/clinics/search?q=${encodeURIComponent(searchQuery)}&size=10`,
            { headers: adminAuthHeaders(), signal: controller.signal },
          );
          if (!res.ok) { setSearchResults([]); return; }
          const page = await res.json();
          const items = (page?.content ?? []).map((c: { id: string; name?: string; city?: string }) => ({
            id: c.id,
            name: c.name,
            city: c.city,
          }));
          setSearchResults(items);
        }
      } catch (e) {
        if ((e as { name?: string })?.name !== 'AbortError') setSearchResults([]);
      }
    };

    const timeout = setTimeout(search, 300);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [searchQuery, targetType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packageId || !targetId || !selectedPackage) return;

    await createCampaign.mutateAsync({
      package_id: packageId,
      doctor_id: targetType === 'doctor' ? targetId : undefined,
      clinic_id: targetType === 'clinic' ? targetId : undefined,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: 'active',
      priority: 0,
      amount_paid: selectedPackage.price,
      currency: selectedPackage.currency,
      payment_date: new Date().toISOString(),
      payment_method: paymentMethod,
      payment_notes: paymentNotes,
      created_by: user?.id,
    });

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setPackageId('');
    setTargetId('');
    setStartDate(new Date());
    setPaymentNotes('');
    setSearchQuery('');
    setSelectedTarget(null);
  };

  const selectTarget = (item: CampaignTarget) => {
    setTargetId(item.id);
    setSelectedTarget(item);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            {t('adminCreateCampaign.btnTrigger')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('adminCreateCampaign.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Type */}
          <div className="space-y-2">
            <Label>{t('adminCreateCampaign.labelType')}</Label>
            <Select value={targetType} onValueChange={(v: 'doctor' | 'clinic') => {
              setTargetType(v);
              setPackageId('');
              setTargetId('');
              setSelectedTarget(null);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="doctor">{t('adminCreateCampaign.typeDoctor')}</SelectItem>
                <SelectItem value="clinic">{t('adminCreateCampaign.typeClinic')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Target */}
          <div className="space-y-2">
            <Label>{targetType === 'doctor' ? t('adminCreateCampaign.labelDoctor') : t('adminCreateCampaign.labelClinic')}</Label>
            {selectedTarget ? (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="font-medium">
                  {targetType === 'doctor'
                    ? selectedTarget.profiles?.full_name
                    : selectedTarget.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTargetId('');
                    setSelectedTarget(null);
                  }}
                >
                  {t('adminCreateCampaign.btnChange')}
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={targetType === 'doctor' ? t('adminCreateCampaign.placeholderSearchDoctor') : t('adminCreateCampaign.placeholderSearchClinic')}
                  className="pl-9"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-auto">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full px-4 py-2 text-left hover:bg-muted transition-colors"
                        onClick={() => selectTarget(item)}
                      >
                        {targetType === 'doctor'
                          ? `${item.profiles?.full_name} — ${item.specialty}`
                          : `${item.name} (${item.city})`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Package */}
          <div className="space-y-2">
            <Label>{t('adminCreateCampaign.labelPackage')}</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder={t('adminCreateCampaign.placeholderPackage')} />
              </SelectTrigger>
              <SelectContent>
                {packages?.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.price.toLocaleString()} {pkg.currency} ({pkg.duration_days} {t('adminCreateCampaign.packageDaysShort')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>{t('adminCreateCampaign.labelStartDate')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, 'PPP', { locale: ru })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedPackage && (
              <p className="text-sm text-muted-foreground">
                {t('adminCreateCampaign.labelEndDate')}{format(endDate, 'PPP', { locale: ru })}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>{t('adminCreateCampaign.labelPaymentMethod')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{t('adminCreateCampaign.methodCash')}</SelectItem>
                <SelectItem value="card">{t('adminCreateCampaign.methodCard')}</SelectItem>
                <SelectItem value="transfer">{t('adminCreateCampaign.methodTransfer')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>{t('adminCreateCampaign.labelNote')}</Label>
            <Textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder={t('adminCreateCampaign.placeholderNote')}
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedPackage && selectedTarget && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{t('adminCreateCampaign.summaryLabel')}</p>
              <p className="text-2xl font-bold text-primary">
                {selectedPackage.price.toLocaleString()} {selectedPackage.currency}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t('admin.cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!packageId || !targetId || createCampaign.isPending}
            >
              {createCampaign.isPending ? t('adminCreateCampaign.btnCreating') : t('adminCreateCampaign.btnCreate')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
