import { Component, ErrorInfo, ReactNode, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClinic } from '@/contexts/ClinicContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit, Clock, Users, Tag, Stethoscope, ListPlus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import {
  archiveClinicService,
  CLINIC_SERVICE_MANAGEMENT_QUERY_KEY,
  invalidateClinicServiceQueries,
  listManagedClinicServices,
  setClinicServicesActive,
  toLegacyClinicService,
} from '@/lib/clinic-service-management-api';
import { AddClinicServiceDialog } from '@/components/crm/services/AddClinicServiceDialog';
import { AddStandardServicesDialog } from '@/components/crm/services/AddStandardServicesDialog';
import { AssignServiceToDoctor } from '@/components/crm/services/AssignServiceToDoctor';
import { DoctorServicesView } from '@/components/crm/services/DoctorServicesView';
import { useModulePermissions } from '@/hooks/useModulePermissions';
import { listClinicDoctorOptions } from '@/lib/clinic-doctor-options';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  duration_minutes: number | null;
  is_active: boolean | null;
  currency?: string;
}

// Functional fallback so we can use the i18n hook for the boundary's text.
function CRMServicesBoundaryFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useLanguage();
  return (
    <CRMLayout>
      <div className="p-8 max-w-2xl">
        <h1 className="mb-2 cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("crmServices.boundaryError")}</h1>
        <p className="text-sm text-muted-foreground mb-3">{error.message}</p>
        <pre className="bg-muted/50 rounded p-3 text-xs whitespace-pre-wrap overflow-auto max-h-[60vh]">
          {error.stack || String(error)}
        </pre>
        <Button className="mt-3" onClick={onReset}>
          {t("crmServices.reload")}
        </Button>
      </div>
    </CRMLayout>
  );
}

// Local error boundary so we can surface the actual error message instead of a blank page.
class CRMServicesBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[CRMServicesBoundary] caught:', error?.message, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <CRMServicesBoundaryFallback
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export default function CRMServicesPage() {
  return (
    <CRMServicesBoundary>
      <CRMServices />
    </CRMServicesBoundary>
  );
}

function CRMServices() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const { canEdit, canManage } = useModulePermissions();
  const canEditServices = canEdit('services');
  const canManageServices = canManage('services');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('clinic');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [standardDialogOpen, setStandardDialogOpen] = useState(false);

  // Management reads use the dedicated clinic-scoped endpoint so inactive services
  // remain visible and can be reactivated. The adapter preserves existing UI props.
  const { data: services, isLoading } = useQuery({
    queryKey: [CLINIC_SERVICE_MANAGEMENT_QUERY_KEY, currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      const rows = await listManagedClinicServices(currentClinic.id);
      return rows.map(toLegacyClinicService) as Service[];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch clinic doctors
  const { data: clinicDoctors } = useQuery({
    queryKey: ['clinic-doctors-for-services', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      return listClinicDoctorOptions(currentClinic.id);
    },
    enabled: !!currentClinic?.id,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      if (!canEditServices) throw new Error(t('crm.accessDenied'));
      if (!currentClinic?.id) throw new Error(t('crmServiceDialogs.noClinicSelected'));
      await setClinicServicesActive(currentClinic.id, [id], is_active);
    },
    onSuccess: () => {
      void invalidateClinicServiceQueries(queryClient);
      toast.success(t("crmServices.serviceUpdated"));
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
      toast.success(t("crmServices.serviceDeleted"));
      setDeleteId(null);
    },
    onError: () => {
      toast.error(t("crmServices.deleteError"));
    },
  });

  // (bulk-add of standard services moved to AddStandardServicesDialog)

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const handleAssign = (service: Service) => {
    setSelectedService(service);
    setAssignDialogOpen(true);
  };

  const filteredServices = (services ?? []).filter(s => {
    const q = search.toLowerCase();
    return (s.name?.toLowerCase().includes(q) ||
      s.category?.toLowerCase().includes(q)) ?? false;
  });

  // Group by category
  const groupedServices = filteredServices?.reduce((acc, service) => {
    const category = service.category || t("crmServices.categoryOther");
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const categories = [...new Set((services ?? []).map(s => s.category).filter(Boolean))];

  return (
    <CRMLayout>
      <div className="space-y-6 p-4 pb-24 lg:p-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
              {t("crmServices.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("crmServices.description")}
            </p>
          </div>
        </div>
        {/* Показатели вместо одиночного бейджа-счётчика. Оба числа считаются
            из уже загруженного прайса: общий размер и сколько позиций реально
            доступно для записи (поле is_active). Никаких новых запросов. */}
        <div className="grid grid-cols-2 gap-section sm:max-w-md">
          <Card>
            <CardContent className="px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">
                {t("crmServices.kpiInPriceList")}
              </p>
              <p className="text-kpi tabular-nums font-heading">{(services ?? []).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">
                {t("crmServices.kpiActive")}
              </p>
              <p className="text-kpi tabular-nums font-heading">
                {(services ?? []).filter((item) => item.is_active).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-0.5 sm:w-fit">
            <TabsTrigger value="clinic" className="gap-2 rounded-lg px-4 py-2">
              <Stethoscope className="h-4 w-4" />
              {t("crmServices.clinicServices")}
            </TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2 rounded-lg px-4 py-2">
              <Users className="h-4 w-4" />
              {t("crmServices.byDoctors")}
            </TabsTrigger>
          </TabsList>

          {/* Clinic Services Tab */}
          <TabsContent value="clinic" className="space-y-4">
            <Card className="overflow-hidden border-border/50 bg-card/80 shadow-soft backdrop-blur-sm">
              <CardHeader className="flex flex-col gap-4 border-b border-border/50 bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="font-heading text-lg">{t("crmServices.pricelist")}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {filteredServices.length} {t("crmServices.clinicServices")}
                  </p>
                </div>
                {canEditServices && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setStandardDialogOpen(true)}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <ListPlus className="h-4 w-4" />
                    {t("crmServices.addStandard")}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingService(null);
                      setIsDialogOpen(true);
                    }}
                    className="w-full gap-2 sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    {t("crmServices.addService")}
                  </Button>
                </div>}
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("crmServices.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-11 border-border bg-background pl-10"
                  />
                </div>

                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <Skeleton key={item} className="h-16 w-full rounded-2xl bg-muted" />
                    ))}
                  </div>
                ) : !filteredServices?.length ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                    <Stethoscope className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">{t("crmServices.notFound")}</p>
                    {canEditServices && <Button
                      onClick={() => setIsDialogOpen(true)}
                      variant="outline"
                      className="mt-4"
                    >
                      {t("crmServices.addFirst")}
                    </Button>}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedServices && Object.entries(groupedServices).map(([category, categoryServices]) => (
                      <div key={category} className="rounded-panel border border-border/50 bg-card/70 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Tag className="h-4 w-4 text-primary" />
                          <h3 className="font-medium text-foreground">{category}</h3>
                          <Badge variant="secondary" className="rounded-full text-xs">
                            {categoryServices.length}
                          </Badge>
                        </div>
                        <div className="overflow-x-auto rounded-panel border border-border">
                          <Table className="min-w-[760px]">
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>{t("crmServices.name")}</TableHead>
                                <TableHead>{t("crmServices.price")}</TableHead>
                                <TableHead>{t("crmServices.duration")}</TableHead>
                                <TableHead>{t("crmServices.active")}</TableHead>
                                <TableHead className="text-right">{t("crmServices.actions")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryServices.map((service) => (
                                <TableRow key={service.id} className="hover:bg-muted/40">
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{service.name}</div>
                                      {service.description && (
                                        <div className="line-clamp-1 text-sm text-muted-foreground">
                                          {service.description}
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium text-primary">
                                    {formatPrice(service.price, service.currency === 'USD' ? '$' : 'сум')}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="h-4 w-4" />
                                      {service.duration_minutes || 30} {t("crmServices.durationMin")}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Switch
                                      checked={service.is_active ?? true}
                                      disabled={!canEditServices}
                                      onCheckedChange={(checked) =>
                                        toggleActiveMutation.mutate({ id: service.id, is_active: checked })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {canEditServices && <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAssign(service)}
                                        title={t("crmServices.assignToDoctors")}
                                      >
                                        <Users className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(service)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      {canManageServices && <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleteId(service.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>}
                                    </div>}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Doctor Services Tab */}
          <TabsContent value="doctors" className="space-y-4">
            <DoctorServicesView
              clinicId={currentClinic?.id}
              doctors={clinicDoctors || []}
              allServices={services || []}
            />
          </TabsContent>
        </Tabs>

        {/* Add/Edit Service Dialog */}
        <AddClinicServiceDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          clinicId={currentClinic?.id}
          editService={editingService}
          categories={(categories || []) as string[]}
        />

        {/* Bulk-add standard services */}
        <AddStandardServicesDialog
          open={standardDialogOpen}
          onOpenChange={setStandardDialogOpen}
          clinicId={currentClinic?.id}
          existingNames={(services ?? []).map((s) => s.name)}
        />

        {/* Assign to Doctors Dialog */}
        {selectedService && (
          <AssignServiceToDoctor
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            service={selectedService}
            clinicId={currentClinic?.id}
            doctors={clinicDoctors || []}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("crmServices.deleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("crmServices.deleteDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("crmServices.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("crmServices.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CRMLayout>
  );
}
