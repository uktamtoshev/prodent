import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Image, Video, FileText, Trash2, MoreHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClinicPortfolioProps {
  clinicId: string;
  isOwner: boolean;
}

export function ClinicPortfolio({ clinicId, isOwner }: ClinicPortfolioProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('image');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['clinic-portfolio', clinicId, filter],
    queryFn: async () => {
      let query = supabase
        .from('clinic_portfolio')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      let mediaUrl = null;
      let beforeUrl = null;
      let afterUrl = null;

      // Upload media file
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const fileName = `clinics/${clinicId}/portfolio/${Date.now()}_media.${ext}`;
        const { data, error } = await supabase.storage
          .from('doctor-media')
          .upload(fileName, mediaFile);
        if (error) throw error;
        const { data: publicUrl } = supabase.storage
          .from('doctor-media')
          .getPublicUrl(data.path);
        mediaUrl = publicUrl.publicUrl;
      }

      // Upload before/after for case type
      if (type === 'case') {
        if (beforeFile) {
          const ext = beforeFile.name.split('.').pop();
          const fileName = `clinics/${clinicId}/portfolio/${Date.now()}_before.${ext}`;
          const { data, error } = await supabase.storage
            .from('doctor-media')
            .upload(fileName, beforeFile);
          if (error) throw error;
          const { data: publicUrl } = supabase.storage
            .from('doctor-media')
            .getPublicUrl(data.path);
          beforeUrl = publicUrl.publicUrl;
        }
        if (afterFile) {
          const ext = afterFile.name.split('.').pop();
          const fileName = `clinics/${clinicId}/portfolio/${Date.now()}_after.${ext}`;
          const { data, error } = await supabase.storage
            .from('doctor-media')
            .upload(fileName, afterFile);
          if (error) throw error;
          const { data: publicUrl } = supabase.storage
            .from('doctor-media')
            .getPublicUrl(data.path);
          afterUrl = publicUrl.publicUrl;
        }
      }

      const { error } = await supabase.from('clinic_portfolio').insert({
        clinic_id: clinicId,
        title,
        description,
        type,
        media_url: mediaUrl,
        before_image_url: beforeUrl,
        after_image_url: afterUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Добавлено в портфолио' });
      queryClient.invalidateQueries({ queryKey: ['clinic-portfolio'] });
      resetForm();
      setShowAddDialog(false);
    },
    onError: (error: any) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clinic_portfolio')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Удалено из портфолио' });
      queryClient.invalidateQueries({ queryKey: ['clinic-portfolio'] });
    },
  });

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('image');
    setMediaFile(null);
    setBeforeFile(null);
    setAfterFile(null);
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case 'video': return Video;
      case 'case': return FileText;
      default: return Image;
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case 'video': return 'Видео';
      case 'case': return 'Кейс';
      case 'certificate': return 'Сертификат';
      default: return 'Фото';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-2 flex-wrap">
          {['all', 'image', 'video', 'case', 'certificate'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Все' : getTypeLabel(f)}
            </Button>
          ))}
        </div>
        
        {isOwner && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Добавить в портфолио</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Тип</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Фото</SelectItem>
                      <SelectItem value="video">Видео</SelectItem>
                      <SelectItem value="case">Кейс (до/после)</SelectItem>
                      <SelectItem value="certificate">Сертификат</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Название</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                
                {type === 'case' ? (
                  <>
                    <div>
                      <Label>Фото "До"</Label>
                      <Input type="file" accept="image/*" onChange={(e) => setBeforeFile(e.target.files?.[0] || null)} />
                    </div>
                    <div>
                      <Label>Фото "После"</Label>
                      <Input type="file" accept="image/*" onChange={(e) => setAfterFile(e.target.files?.[0] || null)} />
                    </div>
                  </>
                ) : (
                  <div>
                    <Label>Файл</Label>
                    <Input 
                      type="file" 
                      accept={type === 'video' ? 'video/*' : 'image/*'} 
                      onChange={(e) => setMediaFile(e.target.files?.[0] || null)} 
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Отмена</Button>
                  <Button onClick={() => addItem.mutate()} disabled={!title || addItem.isPending}>
                    {addItem.isPending ? 'Добавление...' : 'Добавить'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Загрузка...</div>
      ) : portfolio?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Портфолио пока пусто
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {portfolio?.map((item: any) => {
            const Icon = getTypeIcon(item.type);
            return (
              <Card 
                key={item.id} 
                className="overflow-hidden cursor-pointer group"
                onClick={() => setSelectedItem(item)}
              >
                <div className="aspect-square relative bg-muted">
                  {item.type === 'case' ? (
                    <div className="w-full h-full grid grid-cols-2">
                      <img 
                        src={item.before_image_url} 
                        alt="До" 
                        className="w-full h-full object-cover"
                      />
                      <img 
                        src={item.after_image_url} 
                        alt="После" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : item.type === 'video' ? (
                    <video src={item.media_url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={item.media_url} alt={item.title} className="w-full h-full object-cover" />
                  )}
                  
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  <Badge className="absolute top-2 left-2" variant="secondary">
                    {getTypeLabel(item.type)}
                  </Badge>

                  {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          className="absolute top-2 right-2 w-8 h-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteItem.mutate(item.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <CardContent className="p-3">
                  <h4 className="font-medium truncate">{item.title}</h4>
                  {item.description && (
                    <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-3xl">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedItem.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedItem.type === 'case' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">До</p>
                      <img src={selectedItem.before_image_url} alt="До" className="w-full rounded-lg" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">После</p>
                      <img src={selectedItem.after_image_url} alt="После" className="w-full rounded-lg" />
                    </div>
                  </div>
                ) : selectedItem.type === 'video' ? (
                  <video src={selectedItem.media_url} controls className="w-full rounded-lg" />
                ) : (
                  <img src={selectedItem.media_url} alt={selectedItem.title} className="w-full rounded-lg" />
                )}
                {selectedItem.description && (
                  <p className="text-muted-foreground">{selectedItem.description}</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}