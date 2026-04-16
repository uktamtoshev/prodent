import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Settings, Save, Package, Clock, DollarSign, Users, Building2, Plus, ChevronDown } from 'lucide-react';

interface AdPackage {
  id: string;
  name: string;
  name_uz: string | null;
  name_en: string | null;
  description: string | null;
  package_type: string;
  target_type: string;
  price: number;
  currency: string | null;
  duration_days: number;
  max_slots: number | null;
  is_active: boolean | null;
}

interface NewPackageForm {
  name: string;
  name_uz: string;
  name_en: string;
  description: string;
  package_type: string;
  target_type: string;
  price: number;
  duration_days: number;
  max_slots: number | null;
}

const defaultNewPackage: NewPackageForm = {
  name: '',
  name_uz: '',
  name_en: '',
  description: '',
  package_type: 'top_day',
  target_type: 'doctor',
  price: 100000,
  duration_days: 1,
  max_slots: null
};

export function AdPackagesManager() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<AdPackage>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPackage, setNewPackage] = useState<NewPackageForm>(defaultNewPackage);
  const [isOpen, setIsOpen] = useState(false);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['ad-packages-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_packages')
        .select('*')
        .order('target_type', { ascending: true })
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data as AdPackage[];
    }
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdPackage> }) => {
      const { error } = await supabase
        .from('ad_packages')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-packages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ad-packages'] });
      toast.success('Пакет обновлён');
      setEditingId(null);
      setEditValues({});
    },
    onError: () => {
      toast.error('Ошибка при обновлении пакета');
    }
  });

  const createPackage = useMutation({
    mutationFn: async (pkg: NewPackageForm) => {
      const { error } = await supabase
        .from('ad_packages')
        .insert({
          name: pkg.name,
          name_uz: pkg.name_uz || null,
          name_en: pkg.name_en || null,
          description: pkg.description || null,
          package_type: pkg.package_type,
          target_type: pkg.target_type,
          price: pkg.price,
          duration_days: pkg.duration_days,
          max_slots: pkg.max_slots,
          currency: 'UZS',
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-packages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ad-packages'] });
      toast.success('Пакет создан');
      setIsCreateOpen(false);
      setNewPackage(defaultNewPackage);
    },
    onError: () => {
      toast.error('Ошибка при создании пакета');
    }
  });

  const handleEdit = (pkg: AdPackage) => {
    setEditingId(pkg.id);
    setEditValues({
      price: pkg.price,
      duration_days: pkg.duration_days,
      max_slots: pkg.max_slots,
      is_active: pkg.is_active
    });
  };

  const handleSave = (id: string) => {
    updatePackage.mutate({ id, updates: editValues });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleToggleActive = (pkg: AdPackage) => {
    updatePackage.mutate({ 
      id: pkg.id, 
      updates: { is_active: !pkg.is_active } 
    });
  };

  const handleCreatePackage = () => {
    if (!newPackage.name.trim()) {
      toast.error('Введите название пакета');
      return;
    }
    createPackage.mutate(newPackage);
  };

  const formatPrice = (price: number, currency: string | null) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ' + (currency || 'UZS');
  };

  const getPackageTypeLabel = (type: string) => {
    switch (type) {
      case 'top_day': return 'Топ дня';
      case 'top_week': return 'Топ недели';
      case 'top_month': return 'Топ месяца';
      case 'banner': return 'Баннер';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const doctorPackages = packages?.filter(p => p.target_type === 'doctor') || [];
  const clinicPackages = packages?.filter(p => p.target_type === 'clinic') || [];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-card border-border">
        <CollapsibleTrigger asChild>
          <CardHeader className="border-b border-border cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Settings className="h-5 w-5 text-primary" />
                Настройка рекламных пакетов
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              
              <div onClick={(e) => e.stopPropagation()}>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Новый пакет
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Создать рекламный пакет</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Тип цели</Label>
                          <Select
                            value={newPackage.target_type}
                            onValueChange={(v) => setNewPackage({ ...newPackage, target_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="doctor">Врач</SelectItem>
                              <SelectItem value="clinic">Клиника</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Тип пакета</Label>
                          <Select
                            value={newPackage.package_type}
                            onValueChange={(v) => setNewPackage({ ...newPackage, package_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top_day">Топ дня</SelectItem>
                              <SelectItem value="top_week">Топ недели</SelectItem>
                              <SelectItem value="top_month">Топ месяца</SelectItem>
                              <SelectItem value="banner">Баннер</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Название (RU) *</Label>
                        <Input
                          value={newPackage.name}
                          onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                          placeholder="Топ врача на день"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Название (UZ)</Label>
                          <Input
                            value={newPackage.name_uz}
                            onChange={(e) => setNewPackage({ ...newPackage, name_uz: e.target.value })}
                            placeholder="Kunlik top shifokor"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Название (EN)</Label>
                          <Input
                            value={newPackage.name_en}
                            onChange={(e) => setNewPackage({ ...newPackage, name_en: e.target.value })}
                            placeholder="Doctor of the Day"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Описание</Label>
                        <Textarea
                          value={newPackage.description}
                          onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                          placeholder="Описание пакета..."
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Цена (UZS)</Label>
                          <Input
                            type="number"
                            value={newPackage.price}
                            onChange={(e) => setNewPackage({ ...newPackage, price: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Срок (дней)</Label>
                          <Input
                            type="number"
                            value={newPackage.duration_days}
                            onChange={(e) => setNewPackage({ ...newPackage, duration_days: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Макс. слотов</Label>
                          <Input
                            type="number"
                            value={newPackage.max_slots || ''}
                            onChange={(e) => setNewPackage({ ...newPackage, max_slots: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="∞"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                          Отмена
                        </Button>
                        <Button onClick={handleCreatePackage} disabled={createPackage.isPending}>
                          {createPackage.isPending ? 'Создание...' : 'Создать пакет'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-6 space-y-6">
            {/* Doctor Packages */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Пакеты для врачей
              </h3>
              <div className="space-y-3">
                {doctorPackages.map(pkg => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    isEditing={editingId === pkg.id}
                    editValues={editValues}
                    setEditValues={setEditValues}
                    onEdit={() => handleEdit(pkg)}
                    onSave={() => handleSave(pkg.id)}
                    onCancel={handleCancel}
                    onToggleActive={() => handleToggleActive(pkg)}
                    formatPrice={formatPrice}
                    getPackageTypeLabel={getPackageTypeLabel}
                    isSaving={updatePackage.isPending}
                  />
                ))}
                {doctorPackages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет пакетов для врачей</p>
                )}
              </div>
            </div>

            {/* Clinic Packages */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Пакеты для клиник
              </h3>
              <div className="space-y-3">
                {clinicPackages.map(pkg => (
                  <PackageRow
                    key={pkg.id}
                    pkg={pkg}
                    isEditing={editingId === pkg.id}
                    editValues={editValues}
                    setEditValues={setEditValues}
                    onEdit={() => handleEdit(pkg)}
                    onSave={() => handleSave(pkg.id)}
                    onCancel={handleCancel}
                    onToggleActive={() => handleToggleActive(pkg)}
                    formatPrice={formatPrice}
                    getPackageTypeLabel={getPackageTypeLabel}
                    isSaving={updatePackage.isPending}
                  />
                ))}
                {clinicPackages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет пакетов для клиник</p>
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface PackageRowProps {
  pkg: AdPackage;
  isEditing: boolean;
  editValues: Partial<AdPackage>;
  setEditValues: (values: Partial<AdPackage>) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleActive: () => void;
  formatPrice: (price: number, currency: string | null) => string;
  getPackageTypeLabel: (type: string) => string;
  isSaving: boolean;
}

function PackageRow({
  pkg,
  isEditing,
  editValues,
  setEditValues,
  onEdit,
  onSave,
  onCancel,
  onToggleActive,
  formatPrice,
  getPackageTypeLabel,
  isSaving
}: PackageRowProps) {
  return (
    <div className={`p-4 rounded-lg border transition-all ${
      isEditing 
        ? 'border-primary bg-primary/5' 
        : 'border-border bg-muted/30 hover:bg-muted/50'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${pkg.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
            <Package className={`h-4 w-4 ${pkg.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{pkg.name}</span>
              <Badge variant={pkg.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {getPackageTypeLabel(pkg.package_type)}
              </Badge>
              {!pkg.is_active && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Неактивен
                </Badge>
              )}
            </div>
            {pkg.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{pkg.description}</p>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Цена (UZS)</Label>
                <Input
                  type="number"
                  value={editValues.price || ''}
                  onChange={(e) => setEditValues({ ...editValues, price: parseInt(e.target.value) || 0 })}
                  className="h-8 w-32 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Дней</Label>
                <Input
                  type="number"
                  value={editValues.duration_days || ''}
                  onChange={(e) => setEditValues({ ...editValues, duration_days: parseInt(e.target.value) || 0 })}
                  className="h-8 w-20 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Слотов</Label>
                <Input
                  type="number"
                  value={editValues.max_slots || ''}
                  onChange={(e) => setEditValues({ ...editValues, max_slots: parseInt(e.target.value) || null })}
                  className="h-8 w-20 text-sm"
                  placeholder="∞"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={onSave} disabled={isSaving} className="h-8">
                <Save className="h-3 w-3 mr-1" />
                Сохранить
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} className="h-8">
                Отмена
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{formatPrice(pkg.price, pkg.currency)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>{pkg.duration_days} дн.</span>
              </div>
              {pkg.max_slots && (
                <div className="text-muted-foreground text-xs">
                  макс. {pkg.max_slots} слотов
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={pkg.is_active ?? true}
                onCheckedChange={onToggleActive}
              />
              <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
                Изменить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
