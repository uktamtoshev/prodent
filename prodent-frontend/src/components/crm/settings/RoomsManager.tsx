import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { Json } from '@/integrations/supabase/types';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  fetchClinicSetting,
  readClinicRooms,
  saveClinicSetting,
  type ClinicRoom as Room,
} from '@/lib/clinic-settings';

export function RoomsManager() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    equipment: '',
  });

  const [localRooms, setLocalRooms] = useState<Room[]>([]);

  const { data: roomsSettings = [], isLoading } = useQuery({
    queryKey: ['clinic-rooms-settings', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      return readClinicRooms(await fetchClinicSetting(currentClinic.id, 'rooms'));
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    setLocalRooms(roomsSettings);
  }, [roomsSettings]);

  const saveMutation = useMutation({
    mutationFn: async (updatedRooms: Room[]) => {
      if (!currentClinic?.id) throw new Error('No clinic');

      await saveClinicSetting(
        currentClinic.id,
        'rooms',
        updatedRooms as unknown as Json,
      );
      setLocalRooms(updatedRooms);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic-rooms-settings'] });
      toast.success(t('crmRoomsManager.roomUpdated'));
    },
    onError: () => {
      toast.error(t('crmRoomsManager.saveError'));
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
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 px-card-x py-card-y">
        <CardTitle>{t('crmRoomsManager.title')}</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingRoom(null); setFormData({ name: '', description: '', equipment: '' }); }}>
              <Plus className="w-4 h-4 mr-2" />
              {t('crmRoomsManager.addRoom')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRoom ? t('crmRoomsManager.editRoom') : t('crmRoomsManager.newRoom')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm text-muted-foreground">{t('crmRoomsManager.roomName')}</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="№1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t('crmServicesMgr.descriptionLabel')}</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder=""
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t('crmRoomsManager.equipment')}</label>
                <Input
                  value={formData.equipment}
                  onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                  placeholder={t('crmRoomsManager.equipmentPlaceholder')}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSave}
                disabled={!formData.name || saveMutation.isPending}
              >
                {editingRoom ? t('crmRoomsManager.saveBtn') : t('crmRoomsManager.addBtn')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('crmServicesMgr.loading')}</div>
        ) : localRooms.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t('crmRoomsManager.noRooms')}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {localRooms.map((room) => (
              <Card key={room.id} className={`border ${room.is_active ? 'border-border' : 'border-destructive/30 bg-destructive/5'}`}>
                <CardContent className="p-card-x">
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
                        if (confirm(t('crmRoomsManager.confirmDelete'))) {
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
