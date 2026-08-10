import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AddServiceDialog } from './AddServiceDialog';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import {
  archiveDoctorService,
  invalidateDoctorServiceQueries,
} from '@/lib/doctor-services-api';
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
import { useLanguage } from '@/contexts/LanguageContext';
import type { Database } from '@/integrations/supabase/types';

type DoctorServiceRow = Database['public']['Tables']['doctor_services']['Row'];

interface DoctorServicesProps {
  doctorId: string;
}

export function DoctorServices({ doctorId }: DoctorServicesProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editService, setEditService] = useState<DoctorServiceRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Check if current user is the doctor owner
  const { data: doctor } = useQuery({
    queryKey: ['doctor-for-services', doctorId],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('user_id, price_from')
        .eq('id', doctorId)
        .maybeSingle();
      return data;
    },
  });

  const isOwner = user?.id === doctor?.user_id;

  // Fetch doctor's own services
  const { data: services, isLoading } = useQuery<DoctorServiceRow[]>({
    queryKey: ['doctor-services', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_services')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (error) throw error;
      return (data ?? []) as DoctorServiceRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => archiveDoctorService(doctorId, id),
    onSuccess: async () => {
      await invalidateDoctorServiceQueries(queryClient);
      toast.success(t('doctorServicesPage.serviceDeleted'));
      setDeleteId(null);
    },
    onError: () => {
      toast.error(t('doctorServicesPage.deleteError'));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-7 w-48" />
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((j) => (
                <Skeleton key={j} className="h-28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No services - show empty state
  if (!services || services.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Briefcase className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-base font-bold mb-2">{t('doctorServicesPage.noServices')}</h3>
          <p className="text-base text-muted-foreground mb-4">
            {t('doctorServicesPage.noPriceList')}
          </p>
          {isOwner && (
            <Button
              onClick={() => setAddDialogOpen(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('doctorServicesPage.addService')}
            </Button>
          )}
        </div>

        <AddServiceDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          doctorId={doctorId}
        />
      </div>
    );
  }

  // Get unique categories
  const otherLabel = t('doctorServicesPage.otherCategory');
  const categories = ['all', ...new Set(services?.map(s => s.category || otherLabel) || [])];

  const filteredServices = selectedCategory === 'all'
    ? services
    : services?.filter(s => (s.category || otherLabel) === selectedCategory);

  // Group services by category
  const groupedServices = filteredServices?.reduce<Record<string, DoctorServiceRow[]>>((acc, service) => {
    const category = service.category || otherLabel;
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold">{t('doctorServicesPage.servicesAndPrices')}</h2>
        </div>
        {isOwner && (
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('doctorServicesPage.addService')}
          </Button>
        )}
      </div>

      {/* Category Filter - Pill buttons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-base font-medium whitespace-nowrap
              transition-all duration-200
              ${selectedCategory === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }
            `}
          >
            {cat === 'all' ? t('doctorServicesPage.allServices') : cat}
          </button>
        ))}
      </div>

      {/* Quick Book Banner - only for visitors */}
      {!isOwner && (
        <Card className="bg-card border-primary/20">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold">{t('doctorServicesPage.bookAppointment')}</h3>
              <p className="text-base text-muted-foreground">
                {t('doctorServicesPage.pickConvenientTime')}
              </p>
            </div>
            <Button onClick={() => navigate(`/book/${doctorId}`)} className="gap-2">
              {t('doctorServicesPage.bookNow')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Services by Category - Grid layout like Clinic */}
      {groupedServices && Object.entries(groupedServices).map(([category, categoryServices]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h3 className="text-base font-bold text-foreground">{category}</h3>
            <Badge variant="outline" className="text-xs">
              {categoryServices.length}
            </Badge>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {categoryServices.map((service) => (
              <Card
                key={service.id}
                className="group border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300"
              >
                <CardContent className="p-card-x">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {service.name}
                      </h4>
                      {service.description && (
                        <p className="text-base text-muted-foreground mt-1 line-clamp-2">
                          {service.description}
                        </p>
                      )}
                      {service.duration_minutes && (
                        <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-muted text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{service.duration_minutes} {t('doctorServicesPage.durationMin')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-lg font-bold text-primary">
                        {formatPrice(service.price, service.currency === 'USD' ? '$' : 'сум')}
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditService(service)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(service.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Add/Edit Dialog */}
      <AddServiceDialog
        open={addDialogOpen || !!editService}
        onOpenChange={(open) => {
          if (!open) {
            setAddDialogOpen(false);
            setEditService(null);
          }
        }}
        doctorId={doctorId}
        editService={editService}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('doctorServicesPage.deleteServiceQ')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('doctorServicesPage.deleteCannotUndo')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('doctorServicesPage.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('doctorServicesPage.deleteBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
