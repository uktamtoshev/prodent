import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// REST helper for the new ad-flow endpoints (POST/PATCH/DELETE require admin JWT).
const ADS_API_BASE = '/api/v1/ads';
const TOKEN_KEY = 'prodent_access_token';
function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}
async function adsFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ADS_API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const body = await res.json(); msg = body?.message ?? body?.error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}
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
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<AdPackage>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPackage, setNewPackage] = useState<NewPackageForm>(defaultNewPackage);
  const [isOpen, setIsOpen] = useState(false);

  const { data: packages, isLoading } = useQuery({
    queryKey: ['ad-packages-admin'],
    queryFn: async () => {
      // Admin view: get the FULL catalogue including inactive packages.
      const data = await adsFetch<AdPackage[]>('/packages');
      // Order by target_type then price to match the previous UI order.
      return [...data].sort((a, b) => {
        if (a.target_type !== b.target_type) return a.target_type < b.target_type ? -1 : 1;
        return a.price - b.price;
      });
    }
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdPackage> }) => {
      await adsFetch(`/packages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-packages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ad-packages'] });
      toast.success(t('adminAdPackages.packageUpdated'));
      setEditingId(null);
      setEditValues({});
    },
    onError: () => {
      toast.error(t('adminAdPackages.updateError'));
    }
  });

  const createPackage = useMutation({
    mutationFn: async (pkg: NewPackageForm) => {
      await adsFetch('/packages', {
        method: 'POST',
        body: JSON.stringify({
          name: pkg.name,
          name_uz: pkg.name_uz || null,
          name_ru: pkg.name,
          description: pkg.description || null,
          package_type: pkg.package_type,
          target_type: pkg.target_type,
          price: pkg.price,
          duration_days: pkg.duration_days,
          max_slots: pkg.max_slots ?? 1,
          currency: 'UZS',
          is_active: true,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-packages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['ad-packages'] });
      toast.success(t('adminAdPackages.packageCreated'));
      setIsCreateOpen(false);
      setNewPackage(defaultNewPackage);
    },
    onError: () => {
      toast.error(t('adminAdPackages.createError'));
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
      toast.error(t('adminAdPackages.enterName'));
      return;
    }
    createPackage.mutate(newPackage);
  };

  const formatPrice = (price: number, currency: string | null) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ' + (currency || 'UZS');
  };

  const getPackageTypeLabel = (type: string) => {
    switch (type) {
      case 'top_day': return t('adminAdPackages.pkgTopDay');
      case 'top_week': return t('adminAdPackages.pkgTopWeek');
      case 'top_month': return t('adminAdPackages.pkgTopMonth');
      case 'banner': return t('adminAdPackages.pkgBanner');
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
                {t('adminAdPackages.title')}
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </CardTitle>

              <div onClick={(e) => e.stopPropagation()}>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      {t('adminAdPackages.btnNew')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{t('adminAdPackages.dialogTitle')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelTargetType')}</Label>
                          <Select
                            value={newPackage.target_type}
                            onValueChange={(v) => setNewPackage({ ...newPackage, target_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="doctor">{t('adminAdPackages.targetDoctor')}</SelectItem>
                              <SelectItem value="clinic">{t('adminAdPackages.targetClinic')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelPackageType')}</Label>
                          <Select
                            value={newPackage.package_type}
                            onValueChange={(v) => setNewPackage({ ...newPackage, package_type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top_day">{t('adminAdPackages.pkgTopDay')}</SelectItem>
                              <SelectItem value="top_week">{t('adminAdPackages.pkgTopWeek')}</SelectItem>
                              <SelectItem value="top_month">{t('adminAdPackages.pkgTopMonth')}</SelectItem>
                              <SelectItem value="banner">{t('adminAdPackages.pkgBanner')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('adminAdPackages.labelNameRu')} *</Label>
                        <Input
                          value={newPackage.name}
                          onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                          placeholder={t('adminAdPackages.placeholderNameRu')}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelNameUz')}</Label>
                          <Input
                            value={newPackage.name_uz}
                            onChange={(e) => setNewPackage({ ...newPackage, name_uz: e.target.value })}
                            placeholder={t('adminAdPackages.placeholderNameUz')}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelNameEn')}</Label>
                          <Input
                            value={newPackage.name_en}
                            onChange={(e) => setNewPackage({ ...newPackage, name_en: e.target.value })}
                            placeholder={t('adminAdPackages.placeholderNameEn')}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>{t('adminAdPackages.labelDescription')}</Label>
                        <Textarea
                          value={newPackage.description}
                          onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                          placeholder={t('adminAdPackages.placeholderDescription')}
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelPrice')}</Label>
                          <Input
                            type="number"
                            value={newPackage.price}
                            onChange={(e) => setNewPackage({ ...newPackage, price: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelDuration')}</Label>
                          <Input
                            type="number"
                            value={newPackage.duration_days}
                            onChange={(e) => setNewPackage({ ...newPackage, duration_days: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('adminAdPackages.labelMaxSlots')}</Label>
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
                          {t('admin.cancel')}
                        </Button>
                        <Button onClick={handleCreatePackage} disabled={createPackage.isPending}>
                          {createPackage.isPending ? t('adminAdPackages.btnCreating') : t('adminAdPackages.btnCreate')}
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
                {t('adminAdPackages.doctorPackages')}
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
                  <p className="text-sm text-muted-foreground text-center py-4">{t('adminAdPackages.noDoctorPackages')}</p>
                )}
              </div>
            </div>

            {/* Clinic Packages */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {t('adminAdPackages.clinicPackages')}
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
                  <p className="text-sm text-muted-foreground text-center py-4">{t('adminAdPackages.noClinicPackages')}</p>
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
  const { t } = useLanguage();
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
                  {t('adminAdPackages.packageInactive')}
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
                <Label className="text-[10px] text-muted-foreground">{t('adminAdPackages.labelEditPrice')}</Label>
                <Input
                  type="number"
                  value={editValues.price || ''}
                  onChange={(e) => setEditValues({ ...editValues, price: parseInt(e.target.value) || 0 })}
                  className="h-8 w-32 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('adminAdPackages.labelEditDays')}</Label>
                <Input
                  type="number"
                  value={editValues.duration_days || ''}
                  onChange={(e) => setEditValues({ ...editValues, duration_days: parseInt(e.target.value) || 0 })}
                  className="h-8 w-20 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{t('adminAdPackages.labelEditSlots')}</Label>
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
                {t('adminAdPackages.btnSave')}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancel} className="h-8">
                {t('admin.cancel')}
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
                <span>{pkg.duration_days} {t('adminAdPackages.daysShort')}</span>
              </div>
              {pkg.max_slots && (
                <div className="text-muted-foreground text-xs">
                  {t('adminAdPackages.maxSlotsLabel')}{pkg.max_slots}{t('adminAdPackages.slotsLabel')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={pkg.is_active ?? true}
                onCheckedChange={onToggleActive}
              />
              <Button size="sm" variant="ghost" onClick={onEdit} className="h-8">
                {t('adminAdPackages.btnEditAction')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
