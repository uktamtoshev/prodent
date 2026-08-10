import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClinic } from '@/contexts/ClinicContext';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import {
  archiveClinicService,
  CLINIC_SERVICE_MANAGEMENT_QUERY_KEY,
  createClinicService,
  invalidateClinicServiceQueries,
  listManagedClinicServices,
  setClinicServicesActive,
  toLegacyClinicService,
  updateClinicService,
  type ClinicServiceWriteInput,
  type LegacyClinicServiceView,
} from '@/lib/clinic-service-management-api';

type Service = LegacyClinicServiceView;

export function ServicesManager() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { canEdit, canManage } = useModulePermissions();
  const canEditServices = canEdit('services');
  const canManageServices = canManage('services');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: 0,
    duration_minutes: 30,
  });

  const { data: services, isLoading } = useQuery({
    queryKey: [CLINIC_SERVICE_MANAGEMENT_QUERY_KEY, currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      return (await listManagedClinicServices(currentClinic.id)).map(toLegacyClinicService);
    },
    enabled: !!currentClinic?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!canEditServices) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      const previous = data.id ? editingService?.canonical : undefined;
      const input: ClinicServiceWriteInput = {
        nameRu: data.name.trim(),
        nameUz: previous?.nameUz,
        nameUzCyrl: previous?.nameUzCyrl,
        nameKz: previous?.nameKz,
        nameKg: previous?.nameKg,
        nameTj: previous?.nameTj,
        descriptionRu: data.description || null,
        descriptionUz: previous?.descriptionUz,
        descriptionUzCyrl: previous?.descriptionUzCyrl,
        descriptionKz: previous?.descriptionKz,
        descriptionKg: previous?.descriptionKg,
        descriptionTj: previous?.descriptionTj,
        category: data.category || null,
        price: data.price,
        currency: previous?.currency ?? 'UZS',
        duration: data.duration_minutes,
        isActive: previous?.isActive ?? true,
      };
      if (data.id) {
        await updateClinicService(currentClinic.id, data.id, input);
      } else {
        await createClinicService(currentClinic.id, input);
      }
    },
    onSuccess: () => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(editingService ? t('crmServicesMgr.serviceUpdated') : t('crmServicesMgr.serviceAdded'));
      handleCloseDialog();
    },
    onError: () => {
      toast.error(t('crmServicesMgr.saveError'));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!canEditServices) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      await setClinicServicesActive(currentClinic.id, [id], is_active);
    },
    onSuccess: () => {
      void invalidateClinicServiceQueries(queryClient);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canManageServices) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      await archiveClinicService(currentClinic.id, id);
    },
    onSuccess: () => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(t('crmServicesMgr.serviceDeleted'));
    },
    onError: () => {
      toast.error(t('crmServicesMgr.deleteError'));
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setFormData({ name: '', description: '', category: '', price: 0, duration_minutes: 30 });
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      category: service.category || '',
      price: service.price,
      duration_minutes: service.duration_minutes || 30,
    });
    setIsDialogOpen(true);
  };

  const filteredServices = services?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(services?.map(s => s.category).filter(Boolean))];


  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('crmServicesMgr.servicesAndPrices')}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {canEditServices && <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingService(null); setFormData({ name: '', description: '', category: '', price: 0, duration_minutes: 30 }); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('crmServicesMgr.addBtn')}
            </Button>
          </DialogTrigger>}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? t('crmServicesMgr.editService') : t('crmServicesMgr.newService')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">{t('crmServicesMgr.nameLabel')}</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('crmServicesMgr.namePlaceholder')}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t('crmServicesMgr.descriptionLabel')}</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('crmServicesMgr.descriptionPlaceholder')}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t('crmServicesMgr.categoryLabel')}</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder={t('crmServicesMgr.categoryPlaceholder')}
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map(c => <option key={c} value={c!} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">{t('crmServicesMgr.priceLabel')}</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">{t('crmServicesMgr.durationLabel')}</label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => saveMutation.mutate({ ...formData, id: editingService?.id })}
                disabled={!formData.name || saveMutation.isPending}
              >
                {editingService ? t('crmServicesMgr.saveBtn') : t('crmServicesMgr.addServiceBtn')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('crmServicesMgr.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('crmServicesMgr.loading')}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('crmServicesMgr.tableName')}</TableHead>
                <TableHead>{t('crmServicesMgr.tableCategory')}</TableHead>
                <TableHead>{t('crmServicesMgr.tablePrice')}</TableHead>
                <TableHead>{t('crmServicesMgr.tableDuration')}</TableHead>
                <TableHead>{t('crmServicesMgr.tableActive')}</TableHead>
                <TableHead className="text-right">{t('crmServicesMgr.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices?.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-muted-foreground">{service.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {service.category && (
                      <Badge variant="outline">{service.category}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{formatPrice(service.price)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {service.duration_minutes} {t('crmServicesMgr.durationMin')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={service.is_active ?? true}
                      disabled={!canEditServices}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: service.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {canEditServices && <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {canManageServices && <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t('crmServicesMgr.confirmDelete'))) {
                            deleteMutation.mutate(service.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>}
                    </div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
