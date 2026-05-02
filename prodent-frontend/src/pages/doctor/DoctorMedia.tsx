import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Image as ImageIcon, Plus, Upload, FileText, Video, Layers, X } from 'lucide-react';
import { useState } from 'react';

const MEDIA_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  XRAY: { label: 'Рентген', icon: Layers, color: 'bg-blue-500/10 text-blue-700' },
  PHOTO: { label: 'Фото', icon: ImageIcon, color: 'bg-green-500/10 text-green-700' },
  SCAN: { label: '3D-скан', icon: Layers, color: 'bg-purple-500/10 text-purple-700' },
  DOCUMENT: { label: 'Документ', icon: FileText, color: 'bg-amber-500/10 text-amber-700' },
  VIDEO: { label: 'Видео', icon: Video, color: 'bg-red-500/10 text-red-700' },
};

export default function DoctorMedia() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [patientFilter, setPatientFilter] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [form, setForm] = useState({
    patient_id: '',
    media_type: 'PHOTO',
    tooth_number: '',
    title: '',
    description: '',
    file_url: '',
  });

  const { data: doctor } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('doctors')
        .select('id, clinic_id')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: media, isLoading } = useQuery({
    queryKey: ['doctor-media', doctor?.clinic_id, typeFilter, patientFilter],
    queryFn: async () => {
      if (!doctor?.clinic_id) return [] as any[];
      let q = supabase
        .from('medical_media')
        .select('*, patient:users!medical_media_patient_id_fkey(id, first_name, last_name)')
        .eq('clinic_id', doctor.clinic_id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (typeFilter !== 'all') q = q.eq('media_type', typeFilter);
      if (patientFilter !== 'all') q = q.eq('patient_id', patientFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!doctor?.clinic_id,
  });

  const { data: patientsList } = useQuery({
    queryKey: ['doctor-media-patients', doctor?.id],
    queryFn: async () => {
      if (!doctor?.id) return [] as any[];
      const { data } = await supabase
        .from('appointments')
        .select('patient:users!appointments_patient_id_fkey(id, first_name, last_name)')
        .eq('doctor_id', doctor.id);
      const seen = new Set<string>();
      const out: any[] = [];
      (data || []).forEach((r: any) => {
        if (r.patient?.id && !seen.has(r.patient.id)) {
          seen.add(r.patient.id);
          out.push(r.patient);
        }
      });
      return out;
    },
    enabled: !!doctor?.id,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!doctor) throw new Error('No doctor profile');
      const { error } = await supabase.from('medical_media').insert({
        clinic_id: doctor.clinic_id,
        patient_id: form.patient_id,
        uploaded_by: user?.id,
        media_type: form.media_type,
        tooth_number: form.tooth_number ? Number(form.tooth_number) : null,
        title: form.title || null,
        description: form.description || null,
        file_url: form.file_url,
        captured_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-media'] });
      toast({ title: 'Файл добавлен' });
      setUploadOpen(false);
      setForm({ patient_id: '', media_type: 'PHOTO', tooth_number: '', title: '', description: '', file_url: '' });
    },
    onError: (e: any) =>
      toast({ title: 'Ошибка загрузки', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('medical_media').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doctor-media'] });
      toast({ title: 'Удалено' });
      setPreviewItem(null);
    },
  });

  const stats = {
    total: media?.length ?? 0,
    xrays: media?.filter((m: any) => m.media_type === 'XRAY').length ?? 0,
    photos: media?.filter((m: any) => m.media_type === 'PHOTO').length ?? 0,
  };

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-primary" />
              Медиа пациентов
            </h1>
            <p className="text-muted-foreground">Рентген, фото зубов, 3D-сканы и документы</p>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" /> Загрузить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый медиафайл</DialogTitle>
                <DialogDescription>
                  Прикрепите URL файла (загрузка через хранилище временно ручная).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Пациент *</Label>
                  <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите пациента" />
                    </SelectTrigger>
                    <SelectContent>
                      {(patientsList || []).map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Тип *</Label>
                    <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MEDIA_TYPES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Зуб (FDI)</Label>
                    <Input
                      type="number"
                      min="11"
                      max="48"
                      value={form.tooth_number}
                      onChange={(e) => setForm({ ...form, tooth_number: e.target.value })}
                      placeholder="например 26"
                    />
                  </div>
                </div>
                <div>
                  <Label>Название</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Прицельный снимок"
                  />
                </div>
                <div>
                  <Label>URL файла *</Label>
                  <Input
                    value={form.file_url}
                    onChange={(e) => setForm({ ...form, file_url: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadOpen(false)}>Отмена</Button>
                <Button
                  disabled={!form.patient_id || !form.file_url || uploadMut.isPending}
                  onClick={() => uploadMut.mutate()}
                >
                  {uploadMut.isPending ? 'Сохранение…' : 'Сохранить'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Всего файлов</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Рентгены</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.xrays}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Фото</CardTitle>
            </CardHeader>
            <CardContent><p className="text-3xl font-bold">{stats.photos}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Галерея</CardTitle>
              <div className="flex gap-2">
                <Select value={patientFilter} onValueChange={setPatientFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Все пациенты" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все пациенты</SelectItem>
                    {(patientsList || []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                  <TabsList>
                    <TabsTrigger value="all">Все</TabsTrigger>
                    {Object.entries(MEDIA_TYPES).map(([k, v]) => (
                      <TabsTrigger key={k} value={k}>{v.label}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : !media || media.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Файлов пока нет.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {media.map((m: any) => {
                  const meta = MEDIA_TYPES[m.media_type] || MEDIA_TYPES.PHOTO;
                  const Icon = meta.icon;
                  const isImage = m.media_type === 'XRAY' || m.media_type === 'PHOTO';
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPreviewItem(m)}
                      className="relative aspect-square rounded-lg overflow-hidden border bg-muted hover:ring-2 hover:ring-primary transition-all group"
                    >
                      {isImage && m.file_url ? (
                        <img
                          src={m.file_url}
                          alt={m.title || ''}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className="w-10 h-10 opacity-50" />
                        </div>
                      )}
                      <div className="absolute top-1 left-1">
                        <Badge className={meta.color} variant="secondary">
                          <Icon className="w-3 h-3 mr-1" />
                          {meta.label}
                        </Badge>
                      </div>
                      {m.tooth_number && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="outline" className="bg-background/80">
                            #{m.tooth_number}
                          </Badge>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                        <p className="text-xs text-white truncate font-medium">
                          {m.patient?.first_name} {m.patient?.last_name}
                        </p>
                        <p className="text-[10px] text-white/70">
                          {new Date(m.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{previewItem?.title || MEDIA_TYPES[previewItem?.media_type]?.label}</DialogTitle>
              <DialogDescription>
                Пациент: {previewItem?.patient?.first_name} {previewItem?.patient?.last_name} ·{' '}
                {previewItem?.created_at && new Date(previewItem.created_at).toLocaleString('ru-RU')}
              </DialogDescription>
            </DialogHeader>
            {previewItem && (
              <div className="space-y-3">
                {(previewItem.media_type === 'XRAY' || previewItem.media_type === 'PHOTO') && previewItem.file_url && (
                  <img src={previewItem.file_url} alt="" className="w-full rounded border" />
                )}
                {previewItem.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {previewItem.description}
                  </p>
                )}
                <div className="text-xs text-muted-foreground">
                  <a href={previewItem.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Открыть файл
                  </a>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="destructive" onClick={() => deleteMut.mutate(previewItem.id)}>
                <X className="w-4 h-4 mr-2" /> Удалить
              </Button>
              <Button variant="outline" onClick={() => setPreviewItem(null)}>Закрыть</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DoctorLayout>
  );
}
