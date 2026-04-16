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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  children?: React.ReactNode;
}

export function CreateCampaignDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<'doctor' | 'clinic'>('doctor');
  const [packageId, setPackageId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);

  const { user } = useAuth();
  const { data: packages } = useAdPackages(targetType);
  const createCampaign = useCreateCampaign();

  const selectedPackage = packages?.find(p => p.id === packageId);
  const endDate = selectedPackage 
    ? addDays(startDate, selectedPackage.duration_days)
    : startDate;

  // Search doctors or clinics
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const search = async () => {
      if (targetType === 'doctor') {
        const { data } = await supabase
          .from('doctors')
          .select('id, specialty, profiles:profiles!doctors_user_id_fkey(full_name)')
          .ilike('profiles.full_name', `%${searchQuery}%`)
          .limit(10);
        setSearchResults(data || []);
      } else {
        const { data } = await supabase
          .from('clinics')
          .select('id, name, city')
          .ilike('name', `%${searchQuery}%`)
          .limit(10);
        setSearchResults(data || []);
      }
    };

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
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

  const selectTarget = (item: any) => {
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
            Назначить рекламу
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Назначить рекламную кампанию</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Type */}
          <div className="space-y-2">
            <Label>Тип</Label>
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
                <SelectItem value="doctor">Врач</SelectItem>
                <SelectItem value="clinic">Клиника</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Target */}
          <div className="space-y-2">
            <Label>{targetType === 'doctor' ? 'Врач' : 'Клиника'}</Label>
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
                  Изменить
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Поиск ${targetType === 'doctor' ? 'врача' : 'клиники'}...`}
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
            <Label>Пакет</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите пакет" />
              </SelectTrigger>
              <SelectContent>
                {packages?.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.price.toLocaleString()} {pkg.currency} ({pkg.duration_days} дн.)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Дата начала</Label>
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
                Окончание: {format(endDate, 'PPP', { locale: ru })}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Способ оплаты</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные</SelectItem>
                <SelectItem value="card">Карта</SelectItem>
                <SelectItem value="transfer">Перевод</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Примечание</Label>
            <Textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              placeholder="Заметки об оплате..."
              rows={2}
            />
          </div>

          {/* Summary */}
          {selectedPackage && selectedTarget && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">Итого к оплате:</p>
              <p className="text-2xl font-bold text-primary">
                {selectedPackage.price.toLocaleString()} {selectedPackage.currency}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={!packageId || !targetId || createCampaign.isPending}
            >
              {createCampaign.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
