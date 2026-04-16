import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit, Clock, Users, Tag, Stethoscope, ListPlus } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { AddClinicServiceDialog } from '@/components/crm/services/AddClinicServiceDialog';
import { AssignServiceToDoctor } from '@/components/crm/services/AssignServiceToDoctor';
import { DoctorServicesView } from '@/components/crm/services/DoctorServicesView';
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

// Standard dental services with empty prices
const standardServices = [
  // Консультация
  { name: 'Первичная консультация', category: 'Консультация', duration_minutes: 30 },
  { name: 'Повторная консультация', category: 'Консультация', duration_minutes: 20 },
  { name: 'Консультация ортодонта', category: 'Консультация', duration_minutes: 45 },
  { name: 'Консультация хирурга', category: 'Консультация', duration_minutes: 30 },
  { name: 'Консультация имплантолога', category: 'Консультация', duration_minutes: 45 },
  
  // Диагностика
  { name: 'Панорамный снимок (ОПТГ)', category: 'Диагностика', duration_minutes: 15 },
  { name: 'Прицельный рентген-снимок', category: 'Диагностика', duration_minutes: 10 },
  { name: 'Компьютерная томография (КТ)', category: 'Диагностика', duration_minutes: 20 },
  { name: '3D сканирование зубов', category: 'Диагностика', duration_minutes: 30 },
  
  // Терапия
  { name: 'Лечение кариеса', category: 'Терапия', duration_minutes: 45 },
  { name: 'Лечение пульпита', category: 'Терапия', duration_minutes: 60 },
  { name: 'Лечение периодонтита', category: 'Терапия', duration_minutes: 60 },
  { name: 'Пломба светоотверждаемая', category: 'Терапия', duration_minutes: 40 },
  { name: 'Реставрация зуба', category: 'Терапия', duration_minutes: 60 },
  { name: 'Эндодонтическое лечение (1 канал)', category: 'Терапия', duration_minutes: 45 },
  { name: 'Эндодонтическое лечение (2 канала)', category: 'Терапия', duration_minutes: 60 },
  { name: 'Эндодонтическое лечение (3+ каналов)', category: 'Терапия', duration_minutes: 90 },
  
  // Профилактика
  { name: 'Профессиональная чистка зубов', category: 'Профилактика', duration_minutes: 60 },
  { name: 'Ультразвуковая чистка', category: 'Профилактика', duration_minutes: 45 },
  { name: 'Air Flow', category: 'Профилактика', duration_minutes: 40 },
  { name: 'Фторирование зубов', category: 'Профилактика', duration_minutes: 30 },
  { name: 'Герметизация фиссур', category: 'Профилактика', duration_minutes: 30 },
  
  // Хирургия
  { name: 'Удаление зуба простое', category: 'Хирургия', duration_minutes: 30 },
  { name: 'Удаление зуба сложное', category: 'Хирургия', duration_minutes: 60 },
  { name: 'Удаление зуба мудрости', category: 'Хирургия', duration_minutes: 90 },
  { name: 'Резекция верхушки корня', category: 'Хирургия', duration_minutes: 60 },
  { name: 'Пластика уздечки губы', category: 'Хирургия', duration_minutes: 30 },
  { name: 'Пластика уздечки языка', category: 'Хирургия', duration_minutes: 30 },
  { name: 'Синус-лифтинг закрытый', category: 'Хирургия', duration_minutes: 90 },
  { name: 'Синус-лифтинг открытый', category: 'Хирургия', duration_minutes: 120 },
  
  // Имплантация
  { name: 'Имплантация (1 имплант)', category: 'Имплантация', duration_minutes: 60 },
  { name: 'Установка формирователя десны', category: 'Имплантация', duration_minutes: 30 },
  { name: 'Костная пластика', category: 'Имплантация', duration_minutes: 90 },
  { name: 'Установка абатмента', category: 'Имплантация', duration_minutes: 30 },
  
  // Ортопедия
  { name: 'Металлокерамическая коронка', category: 'Ортопедия', duration_minutes: 45 },
  { name: 'Циркониевая коронка', category: 'Ортопедия', duration_minutes: 45 },
  { name: 'Керамическая коронка E-max', category: 'Ортопедия', duration_minutes: 45 },
  { name: 'Временная коронка', category: 'Ортопедия', duration_minutes: 30 },
  { name: 'Винир керамический', category: 'Ортопедия', duration_minutes: 60 },
  { name: 'Мостовидный протез (1 единица)', category: 'Ортопедия', duration_minutes: 45 },
  { name: 'Съёмный протез частичный', category: 'Ортопедия', duration_minutes: 60 },
  { name: 'Съёмный протез полный', category: 'Ортопедия', duration_minutes: 60 },
  { name: 'Бюгельный протез', category: 'Ортопедия', duration_minutes: 60 },
  { name: 'Вкладка культевая', category: 'Ортопедия', duration_minutes: 40 },
  
  // Ортодонтия
  { name: 'Установка брекет-системы (металлическая)', category: 'Ортодонтия', duration_minutes: 120 },
  { name: 'Установка брекет-системы (керамическая)', category: 'Ортодонтия', duration_minutes: 120 },
  { name: 'Установка брекет-системы (сапфировая)', category: 'Ортодонтия', duration_minutes: 120 },
  { name: 'Элайнеры (полный курс)', category: 'Ортодонтия', duration_minutes: 60 },
  { name: 'Активация брекет-системы', category: 'Ортодонтия', duration_minutes: 45 },
  { name: 'Снятие брекет-системы', category: 'Ортодонтия', duration_minutes: 60 },
  { name: 'Ретейнер несъёмный', category: 'Ортодонтия', duration_minutes: 45 },
  
  // Эстетика
  { name: 'Отбеливание зубов (кабинетное)', category: 'Эстетика', duration_minutes: 90 },
  { name: 'Отбеливание зубов (домашнее)', category: 'Эстетика', duration_minutes: 30 },
  { name: 'Художественная реставрация', category: 'Эстетика', duration_minutes: 90 },
  { name: 'Украшение зуба (скайс)', category: 'Эстетика', duration_minutes: 20 },
  
  // Детская стоматология
  { name: 'Лечение молочного зуба', category: 'Детская стоматология', duration_minutes: 30 },
  { name: 'Удаление молочного зуба', category: 'Детская стоматология', duration_minutes: 20 },
  { name: 'Серебрение зубов', category: 'Детская стоматология', duration_minutes: 20 },
  { name: 'Герметизация фиссур (детская)', category: 'Детская стоматология', duration_minutes: 25 },
  { name: 'Пломба на молочный зуб', category: 'Детская стоматология', duration_minutes: 30 },
];

export default function CRMServices() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('clinic');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

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
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('services')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      toast.success('Статус услуги обновлён');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      toast.success('Услуга удалена');
      setDeleteId(null);
    },
    onError: () => {
      toast.error('Ошибка при удалении');
    },
  });

  // Add standard services mutation
  const addStandardServicesMutation = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error('Клиника не выбрана');
      
      // Get existing service names to avoid duplicates
      const { data: existingServices } = await supabase
        .from('services')
        .select('name')
        .eq('clinic_id', currentClinic.id);
      
      const existingNames = new Set(existingServices?.map(s => s.name.toLowerCase()) || []);
      
      // Filter out services that already exist
      const newServices = standardServices.filter(
        s => !existingNames.has(s.name.toLowerCase())
      ).map(s => ({
        name: s.name,
        category: s.category,
        duration_minutes: s.duration_minutes,
        price: 0, // Empty price for clinic to set
        currency: 'UZS',
        clinic_id: currentClinic.id,
        is_active: false, // Inactive until price is set
      }));
      
      if (newServices.length === 0) {
        throw new Error('Все стандартные услуги уже добавлены');
      }
      
      const { error } = await supabase
        .from('services')
        .insert(newServices);
      
      if (error) throw error;
      
      return newServices.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['clinic-services'] });
      toast.success(`Добавлено ${count} стандартных услуг. Установите цены и активируйте их.`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Ошибка при добавлении услуг');
    },
  });

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsDialogOpen(true);
  };

  const handleAssign = (service: Service) => {
    setSelectedService(service);
    setAssignDialogOpen(true);
  };

  const filteredServices = services?.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const groupedServices = filteredServices?.reduce((acc, service) => {
    const category = service.category || 'Другие';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const categories = [...new Set(services?.map(s => s.category).filter(Boolean))];

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-heading font-semibold text-foreground">
              Управление услугами
            </h1>
            <p className="text-muted-foreground">
              Настройка услуг клиники и назначение врачам
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="clinic" className="gap-2">
              <Stethoscope className="w-4 h-4" />
              Услуги клиники
            </TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2">
              <Users className="w-4 h-4" />
              По врачам
            </TabsTrigger>
          </TabsList>

          {/* Clinic Services Tab */}
          <TabsContent value="clinic" className="space-y-4">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <CardTitle className="text-lg font-heading">Прайс-лист клиники</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => addStandardServicesMutation.mutate()}
                    disabled={addStandardServicesMutation.isPending}
                    className="gap-2"
                  >
                    <ListPlus className="w-4 h-4" />
                    {addStandardServicesMutation.isPending ? 'Добавление...' : 'Добавить стандартные услуги'}
                  </Button>
                  <Button 
                    onClick={() => { 
                      setEditingService(null); 
                      setIsDialogOpen(true); 
                    }}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить услугу
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск услуг..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                ) : !filteredServices?.length ? (
                  <div className="text-center py-12">
                    <Stethoscope className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Услуги не найдены</p>
                    <Button 
                      onClick={() => setIsDialogOpen(true)} 
                      variant="outline" 
                      className="mt-4"
                    >
                      Добавить первую услугу
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedServices && Object.entries(groupedServices).map(([category, categoryServices]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="w-4 h-4 text-primary" />
                          <h3 className="font-medium text-foreground">{category}</h3>
                          <Badge variant="secondary" className="text-xs">
                            {categoryServices.length}
                          </Badge>
                        </div>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Название</TableHead>
                                <TableHead>Цена</TableHead>
                                <TableHead>Длительность</TableHead>
                                <TableHead>Активна</TableHead>
                                <TableHead className="text-right">Действия</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {categoryServices.map((service) => (
                                <TableRow key={service.id}>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{service.name}</div>
                                      {service.description && (
                                        <div className="text-sm text-muted-foreground line-clamp-1">
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
                                      <Clock className="w-4 h-4" />
                                      {service.duration_minutes || 30} мин
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Switch
                                      checked={service.is_active ?? true}
                                      onCheckedChange={(checked) => 
                                        toggleActiveMutation.mutate({ id: service.id, is_active: checked })
                                      }
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => handleAssign(service)}
                                        title="Назначить врачам"
                                      >
                                        <Users className="w-4 h-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleEdit(service)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setDeleteId(service.id)}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
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
          <TabsContent value="doctors">
            <DoctorServicesView 
              clinicId={currentClinic?.id} 
              doctors={clinicDoctors} 
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
          categories={categories as string[]}
        />

        {/* Assign to Doctors Dialog */}
        {selectedService && (
          <AssignServiceToDoctor
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            service={selectedService}
            clinicId={currentClinic?.id}
            doctors={clinicDoctors}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить услугу?</AlertDialogTitle>
              <AlertDialogDescription>
                Это действие нельзя отменить. Услуга будет удалена из прайс-листа.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Удалить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CRMLayout>
  );
}