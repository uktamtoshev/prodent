import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { ManagerLayout } from '@/components/manager/ManagerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { Plus, ListPlus, Stethoscope, History } from 'lucide-react';

import { ServicesTable } from '@/components/manager/services/ServicesTable';
import { ServicesFilters } from '@/components/manager/services/ServicesFilters';
import { ServicesEmptyState } from '@/components/manager/services/ServicesEmptyState';
import { ServicesMassActions } from '@/components/manager/services/ServicesMassActions';
import { AddStandardServicesDialog } from '@/components/manager/services/AddStandardServicesDialog';
import { AssignServiceDialog } from '@/components/manager/services/AssignServiceDialog';
import { ExportPriceButton } from '@/components/manager/services/ExportPriceButton';
import { AddClinicServiceDialog } from '@/components/crm/services/AddClinicServiceDialog';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function ManagerServices() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  
  // Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  
  // Selection state
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  
  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [standardDialogOpen, setStandardDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [assignService, setAssignService] = useState<Service | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  // Fetch clinic services
  const { data: services, isLoading } = useQuery({
    queryKey: ['clinic-services', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch clinic doctors
  const { data: clinicDoctors } = useQuery({
    queryKey: ['clinic-doctors-for-services', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('doctor_clinic_affiliations')
        .select(`
          doctor_id,
          doctors:doctor_id (
            id,
            specialty,
            profiles:user_id (
              full_name,
              avatar_url
            )
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      toast.success(deleteIds.length > 1 ? 'Услуги удалены' : 'Услуга удалена');
      setDeleteConfirmOpen(false);
      setDeleteIds([]);
      setSelectedServices(new Set());
    },
    onError: () => {
      toast.error('Ошибка при удалении');
    },
  });

  // Filter services
  const filteredServices = services?.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && s.is_active !== false) ||
      (statusFilter === 'inactive' && s.is_active === false);
    
    return matchesSearch && matchesCategory && matchesStatus;
  }) || [];

  const categories = [...new Set(services?.map(s => s.category).filter(Boolean) || [])];
  const activeCount = services?.filter(s => s.is_active !== false).length || 0;

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedServices(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedServices(new Set(filteredServices.map(s => s.id)));
    } else {
      setSelectedServices(new Set());
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setAddDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteIds([id]);
    setDeleteConfirmOpen(true);
  };

  const handleMassDelete = () => {
    setDeleteIds(Array.from(selectedServices));
    setDeleteConfirmOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  if (isLoading) {
    return (
      <ManagerLayout>
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-primary" />
              </div>
              Управление услугами
            </h1>
            <p className="text-muted-foreground mt-1">
              Настройка прайс-листа и назначение услуг врачам
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {services && services.length > 0 && (
              <>
                <ExportPriceButton 
                  services={services} 
                  clinicName={currentClinic?.name || 'Клиника'} 
                />
                <Button variant="outline" className="gap-2">
                  <History className="w-4 h-4" />
                  История изменений
                </Button>
              </>
            )}
            <Button 
              variant="outline"
              onClick={() => setStandardDialogOpen(true)}
              className="gap-2"
            >
              <ListPlus className="w-4 h-4" />
              Стандартные услуги
            </Button>
            <Button 
              onClick={() => { 
                setEditingService(null); 
                setAddDialogOpen(true); 
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Своя услуга
            </Button>
          </div>
        </div>

        {/* Content */}
        {!services || services.length === 0 ? (
          <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-soft">
            <CardContent className="p-0">
              <ServicesEmptyState
                onAddStandard={() => setStandardDialogOpen(true)}
                onAddCustom={() => setAddDialogOpen(true)}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters */}
            <ServicesFilters
              search={search}
              onSearchChange={setSearch}
              categoryFilter={categoryFilter}
              onCategoryChange={setCategoryFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              categories={categories}
              totalCount={services.length}
              activeCount={activeCount}
              onReset={resetFilters}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            {/* Mass Actions */}
            <ServicesMassActions
              selectedCount={selectedServices.size}
              selectedIds={Array.from(selectedServices)}
              onClearSelection={() => setSelectedServices(new Set())}
              onDeleteConfirm={handleMassDelete}
            />

            {/* Table */}
            {filteredServices.length === 0 ? (
              <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    По вашему запросу ничего не найдено
                  </p>
                  <Button variant="outline" onClick={resetFilters}>
                    Сбросить фильтры
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ServicesTable
                services={filteredServices}
                doctors={clinicDoctors || []}
                selectedServices={selectedServices}
                onToggleSelect={handleToggleSelect}
                onSelectAll={handleSelectAll}
                onEdit={handleEdit}
                onAssign={(service) => setAssignService(service)}
                onDelete={handleDelete}
                groupedByCategory={viewMode === 'grouped'}
              />
            )}
          </>
        )}

        {/* Dialogs */}
        <AddClinicServiceDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          clinicId={currentClinic?.id}
          editService={editingService}
          categories={categories}
        />

        <AddStandardServicesDialog
          open={standardDialogOpen}
          onOpenChange={setStandardDialogOpen}
          clinicId={currentClinic?.id || ''}
          existingServiceNames={services?.map(s => s.name) || []}
        />

        <AssignServiceDialog
          open={!!assignService}
          onOpenChange={(open) => !open && setAssignService(null)}
          service={assignService}
          clinicId={currentClinic?.id || ''}
          doctors={clinicDoctors || []}
        />

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить услуги?</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteIds.length === 1 
                  ? 'Это действие нельзя отменить. Услуга будет удалена из прайс-листа.'
                  : `Это действие нельзя отменить. Будет удалено ${deleteIds.length} услуг.`
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(deleteIds)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ManagerLayout>
  );
}
