import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  duration_minutes: number | null;
  is_active: boolean | null;
}

export function ServicesManager() {
  const { currentClinic } = useClinic();
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
    queryKey: ['services', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('category', { ascending: true });

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!currentClinic?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (data.id) {
        const { error } = await supabase
          .from('services')
          .update({
            name: data.name,
            description: data.description || null,
            category: data.category || null,
            price: data.price,
            duration_minutes: data.duration_minutes,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('services')
          .insert({
            clinic_id: currentClinic!.id,
            name: data.name,
            description: data.description || null,
            category: data.category || null,
            price: data.price,
            duration_minutes: data.duration_minutes,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success(editingService ? 'Услуга обновлена' : 'Услуга добавлена');
      handleCloseDialog();
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
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
      queryClient.invalidateQueries({ queryKey: ['services'] });
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
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Услуга удалена');
    },
    onError: () => {
      toast.error('Ошибка при удалении');
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
        <CardTitle>Услуги и цены</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingService(null); setFormData({ name: '', description: '', category: '', price: 0, duration_minutes: 30 }); }}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? 'Редактировать услугу' : 'Новая услуга'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">Название *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Название услуги"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Описание</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Категория</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Терапия, Хирургия и т.д."
                  list="categories"
                />
                <datalist id="categories">
                  {categories.map(c => <option key={c} value={c!} />)}
                </datalist>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Цена (сум) *</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Длительность (мин)</label>
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
                {editingService ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
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
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Активна</TableHead>
                <TableHead className="text-right">Действия</TableHead>
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
                      {service.duration_minutes} мин
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={service.is_active ?? true}
                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: service.id, is_active: checked })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(service)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm('Удалить услугу?')) {
                            deleteMutation.mutate(service.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
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
