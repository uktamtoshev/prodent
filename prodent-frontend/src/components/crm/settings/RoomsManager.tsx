import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { useClinic } from '@/contexts/ClinicContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Trash2, Edit, DoorOpen } from 'lucide-react';
import type { Json } from '@/integrations/api/types';

interface Room {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  equipment: string[];
}

export function RoomsManager() {
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    equipment: '',
  });

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['clinic-rooms', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      // Use raw query since table might not be in types yet
      const { data, error } = await supabase
        .rpc('get_clinic_rooms' as never, { p_clinic_id: currentClinic.id } as never);

      // Fallback to direct query
      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('clinic_settings')
          .select('value')
          .eq('clinic_id', currentClinic.id)
          .eq('key', 'rooms')
          .single();
        
        if (fallbackError && fallbackError.code !== 'PGRST116') throw fallbackError;
        return ((fallbackData?.value as unknown) as Room[]) || [];
      }
      return (data as unknown as Room[]) || [];
    },
    enabled: !!currentClinic?.id,
  });

  const [localRooms, setLocalRooms] = useState<Room[]>([]);

  // Initialize local rooms from settings
  const { data: roomsSettings } = useQuery({
    queryKey: ['clinic-rooms-settings', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      
      const { data, error } = await supabase
        .from('clinic_settings')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('key', 'rooms')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data?.value) {
        setLocalRooms((data.value as unknown as Room[]) || []);
      }
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (updatedRooms: Room[]) => {
      if (!currentClinic?.id) throw new Error('No clinic');

      const { error } = await supabase
        .from('clinic_settings')
        .upsert([{
          clinic_id: currentClinic.id,
          key: 'rooms',
          value: updatedRooms as unknown as Json,
          description: 'Кабинеты клиники',
        }], {
          onConflict: 'clinic_id,key',
        });

      if (error) throw error;
      setLocalRooms(updatedRooms);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-rooms-settings'] });
      toast.success('Сохранено');
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRoom(null);
    setFormData({ name: '', description: '', equipment: '' });
  };

  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      description: room.description || '',
      equipment: room.equipment?.join(', ') || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const equipment = formData.equipment
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    let updatedRooms: Room[];
    if (editingRoom) {
      updatedRooms = localRooms.map(r => 
        r.id === editingRoom.id 
          ? { ...r, name: formData.name, description: formData.description || null, equipment }
          : r
      );
    } else {
      updatedRooms = [...localRooms, {
        id: crypto.randomUUID(),
        name: formData.name,
        description: formData.description || null,
        is_active: true,
        equipment,
      }];
    }
    
    saveMutation.mutate(updatedRooms);
    handleCloseDialog();
  };

  const handleToggleActive = (roomId: string, isActive: boolean) => {
    const updatedRooms = localRooms.map(r => 
      r.id === roomId ? { ...r, is_active: isActive } : r
    );
    saveMutation.mutate(updatedRooms);
  };

  const handleDelete = (roomId: string) => {
    const updatedRooms = localRooms.filter(r => r.id !== roomId);
    saveMutation.mutate(updatedRooms);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Кабинеты</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingRoom(null); setFormData({ name: '', description: '', equipment: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRoom ? 'Редактировать кабинет' : 'Новый кабинет'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">Название *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Кабинет №1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Описание</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Описание кабинета"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Оборудование (через запятую)</label>
                <Input
                  value={formData.equipment}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  placeholder="Стоматологическое кресло, Рентген, ..."
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleSave}
                disabled={!formData.name || saveMutation.isPending}
              >
                {editingRoom ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : localRooms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Нет кабинетов</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {localRooms.map((room) => (
              <Card key={room.id} className={`border ${room.is_active ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="w-5 h-5 text-primary" />
                      <h3 className="font-medium">{room.name}</h3>
                    </div>
                    <Switch
                      checked={room.is_active}
                      onCheckedChange={(checked) => handleToggleActive(room.id, checked)}
                    />
                  </div>
                  {room.description && (
                    <p className="text-sm text-muted-foreground mb-2">{room.description}</p>
                  )}
                  {room.equipment && room.equipment.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {room.equipment.map((eq, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{eq}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(room)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Удалить кабинет?')) {
                          handleDelete(room.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
