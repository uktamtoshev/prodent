import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Calendar, Percent, Building2, User, Upload, Image as ImageIcon, X, Crop } from 'lucide-react';
import { AvatarCropper } from '@/components/ui/avatar-cropper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const categories = [
  { value: 'whitening', label: 'Отбеливание' },
  { value: 'cleaning', label: 'Чистка' },
  { value: 'implants', label: 'Имплантация' },
  { value: 'braces', label: 'Брекеты' },
  { value: 'prosthetics', label: 'Протезирование' },
  { value: 'treatment', label: 'Лечение' },
  { value: 'extraction', label: 'Удаление' },
  { value: 'kids', label: 'Детская стоматология' },
  { value: 'other', label: 'Другое' },
];

interface PromotionForm {
  title: string;
  description: string;
  discount: number;
  price: number;
  old_price: number;
  valid_until: string;
  image_url: string;
  category: string;
  clinic_id: string | null;
  doctor_id: string | null;
  active: boolean;
}

const initialForm: PromotionForm = {
  title: '',
  description: '',
  discount: 0,
  price: 0,
  old_price: 0,
  valid_until: '',
  image_url: '',
  category: 'other',
  clinic_id: null,
  doctor_id: null,
  active: true,
};

export default function AdminPromotions() {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionForm>(initialForm);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['admin-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          clinic:clinics(id, name),
          doctor:doctors(id, user_id, profiles:user_id(full_name))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clinics } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('id, name').order('name');
      return data || [];
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id, user_id, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB');
      return;
    }

    // Store file and open cropper
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setTempImageSrc(e.target?.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `promotions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('promotions')
        .upload(filePath, croppedBlob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('promotions')
        .getPublicUrl(filePath);

      // Create preview from blob
      const previewUrl = URL.createObjectURL(croppedBlob);
      setPreviewImage(previewUrl);
      setForm({ ...form, image_url: publicUrl });
      toast.success('Изображение загружено');
    } catch (error: any) {
      toast.error('Ошибка загрузки: ' + error.message);
      setPreviewImage(null);
    } finally {
      setUploading(false);
      setTempImageSrc(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCropperClose = () => {
    setCropperOpen(false);
    setTempImageSrc(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setPreviewImage(null);
    setForm({ ...form, image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: PromotionForm) => {
      const { error } = await supabase.from('promotions').insert({
        ...data,
        clinic_id: data.clinic_id || null,
        doctor_id: data.doctor_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Акция создана');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PromotionForm }) => {
      const { error } = await supabase.from('promotions').update({
        ...data,
        clinic_id: data.clinic_id || null,
        doctor_id: data.doctor_id || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Акция обновлена');
      resetForm();
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Акция удалена');
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success('Статус изменён');
    },
  });

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setIsOpen(false);
    setPreviewImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (promo: any) => {
    setForm({
      title: promo.title,
      description: promo.description,
      discount: promo.discount,
      price: promo.price,
      old_price: promo.old_price,
      valid_until: promo.valid_until?.split('T')[0] || '',
      image_url: promo.image_url || '',
      category: promo.category,
      clinic_id: promo.clinic_id,
      doctor_id: promo.doctor_id,
      active: promo.active,
    });
    setPreviewImage(promo.image_url || null);
    setEditingId(promo.id);
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (!form.title || !form.valid_until || !form.category) {
      toast.error('Заполните обязательные поля');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'd MMM yyyy', { locale: ru });
    } catch {
      return date;
    }
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + ' сум';
  };

  // Get clinic/doctor name for preview
  const getClinicName = () => {
    if (form.clinic_id) {
      return clinics?.find(c => c.id === form.clinic_id)?.name || 'Клиника';
    }
    return null;
  };

  const getDoctorName = () => {
    if (form.doctor_id) {
      const doc = doctors?.find(d => d.id === form.doctor_id);
      return (doc?.profiles as any)?.full_name || 'Врач';
    }
    return null;
  };

  return (
    <>
      {/* Image Cropper Modal */}
      {tempImageSrc && (
        <AvatarCropper
          open={cropperOpen}
          onClose={handleCropperClose}
          imageSrc={tempImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={16 / 9}
          circularCrop={false}
        />
      )}
      
      <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Акции</h1>
            <p className="text-slate-400 mt-2">Управление акциями и специальными предложениями</p>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#00C6BB] hover:bg-[#00C6BB]/90">
                <Plus className="h-4 w-4" />
                Создать акцию
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Редактировать акцию' : 'Новая акция'}</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Название *</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Отбеливание со скидкой 30%"
                      className="bg-slate-800 border-slate-700"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Описание *</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Описание акции..."
                      className="bg-slate-800 border-slate-700 min-h-[80px]"
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <Label>Изображение</Label>
                    <div className="mt-2">
                      {(previewImage || form.image_url) ? (
                        <div className="relative inline-block">
                          <img 
                            src={previewImage || form.image_url} 
                            alt="Preview" 
                            className="w-full max-w-[200px] h-32 object-cover rounded-lg border border-slate-700"
                          />
                          <button
                            type="button"
                            onClick={removeImage}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center cursor-pointer hover:border-slate-600 transition-colors"
                        >
                          {uploading ? (
                            <div className="flex items-center justify-center gap-2 text-slate-400">
                              <div className="animate-spin h-5 w-5 border-2 border-slate-400 border-t-transparent rounded-full" />
                              Загрузка...
                            </div>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto text-slate-500 mb-2" />
                              <p className="text-slate-400 text-sm">Нажмите для загрузки</p>
                              <p className="text-slate-500 text-xs mt-1">PNG, JPG до 5MB</p>
                            </>
                          )}
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">Категория *</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="discount">Скидка %</Label>
                      <Input
                        id="discount"
                        type="number"
                        value={form.discount}
                        onChange={(e) => setForm({ ...form, discount: parseInt(e.target.value) || 0 })}
                        placeholder="30"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <Label htmlFor="old_price">Старая цена</Label>
                      <Input
                        id="old_price"
                        type="number"
                        value={form.old_price}
                        onChange={(e) => setForm({ ...form, old_price: parseInt(e.target.value) || 0 })}
                        placeholder="1000000"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">Новая цена *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                        placeholder="700000"
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <Label htmlFor="valid_until">Действует до *</Label>
                      <Input
                        id="valid_until"
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                        className="bg-slate-800 border-slate-700"
                      />
                    </div>

                    <div>
                      <Label htmlFor="clinic">Клиника</Label>
                      <Select 
                        value={form.clinic_id || 'none'} 
                        onValueChange={(v) => setForm({ ...form, clinic_id: v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700">
                          <SelectValue placeholder="Выберите" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="none">Не указано</SelectItem>
                          {clinics?.map((clinic) => (
                            <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="doctor">Врач</Label>
                    <Select 
                      value={form.doctor_id || 'none'} 
                      onValueChange={(v) => setForm({ ...form, doctor_id: v === 'none' ? null : v })}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700">
                        <SelectValue placeholder="Выберите врача" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="none">Не указано</SelectItem>
                        {doctors?.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {(doc.profiles as any)?.full_name || 'Врач'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending || uploading}
                    className="w-full bg-[#00C6BB] hover:bg-[#00C6BB]/90"
                  >
                    {editingId ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>

                {/* Live Preview Section */}
                <div className="space-y-4">
                  <Label className="text-slate-400">Предпросмотр карточки</Label>
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
                    {/* Preview Card */}
                    <div className="relative">
                      {(previewImage || form.image_url) ? (
                        <img 
                          src={previewImage || form.image_url}
                          alt="Preview"
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-slate-800 flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-slate-600" />
                        </div>
                      )}
                      {form.discount > 0 && (
                        <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                          -{form.discount}%
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 space-y-3">
                      <div>
                        <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">
                          {categories.find(c => c.value === form.category)?.label || 'Категория'}
                        </Badge>
                      </div>
                      
                      <h3 className="text-white font-semibold text-lg line-clamp-2">
                        {form.title || 'Название акции'}
                      </h3>
                      
                      <p className="text-slate-400 text-sm line-clamp-2">
                        {form.description || 'Описание акции будет отображаться здесь...'}
                      </p>
                      
                      <div className="flex items-baseline gap-2">
                        <span className="text-[#00C6BB] text-xl font-bold">
                          {form.price > 0 ? formatPrice(form.price) : '0 сум'}
                        </span>
                        {form.old_price > 0 && (
                          <span className="text-slate-500 line-through text-sm">
                            {formatPrice(form.old_price)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        {(getClinicName() || getDoctorName()) && (
                          <div className="flex items-center gap-1">
                            {getClinicName() && (
                              <>
                                <Building2 className="h-3.5 w-3.5" />
                                <span>{getClinicName()}</span>
                              </>
                            )}
                            {getDoctorName() && (
                              <>
                                <User className="h-3.5 w-3.5 ml-2" />
                                <span>{getDoctorName()}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {form.valid_until && (
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>до {formatDate(form.valid_until)}</span>
                        </div>
                      )}
                      
                      <Button className="w-full bg-[#00C6BB] hover:bg-[#00C6BB]/90 mt-2">
                        Записаться
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Название</TableHead>
                <TableHead className="text-slate-400">Категория</TableHead>
                <TableHead className="text-slate-400">Скидка</TableHead>
                <TableHead className="text-slate-400">Цена</TableHead>
                <TableHead className="text-slate-400">Действует до</TableHead>
                <TableHead className="text-slate-400">Привязка</TableHead>
                <TableHead className="text-slate-400">Статус</TableHead>
                <TableHead className="text-slate-400">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                    Загрузка...
                  </TableCell>
                </TableRow>
              ) : promotions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                    Акции не найдены
                  </TableCell>
                </TableRow>
              ) : (
                promotions?.map((promo) => (
                  <TableRow key={promo.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {promo.image_url ? (
                          <img 
                            src={promo.image_url} 
                            alt="" 
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-slate-600" />
                          </div>
                        )}
                        <div>
                          <div className="text-white font-medium">{promo.title}</div>
                          <div className="text-slate-400 text-sm truncate max-w-[200px]">
                            {promo.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-slate-300">
                        {categories.find(c => c.value === promo.category)?.label || promo.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-green-400 font-semibold">
                        <Percent className="h-4 w-4" />
                        {promo.discount}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-white">{formatPrice(promo.price)}</div>
                      {promo.old_price > 0 && (
                        <div className="text-slate-500 text-sm line-through">
                          {formatPrice(promo.old_price)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${isExpired(promo.valid_until) ? 'text-red-400' : 'text-slate-300'}`}>
                        <Calendar className="h-4 w-4" />
                        {formatDate(promo.valid_until)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {promo.clinic && (
                          <div className="flex items-center gap-1 text-slate-300 text-sm">
                            <Building2 className="h-3 w-3" />
                            {(promo.clinic as any).name}
                          </div>
                        )}
                        {promo.doctor && (
                          <div className="flex items-center gap-1 text-slate-300 text-sm">
                            <User className="h-3 w-3" />
                            {(promo.doctor as any).profiles?.full_name || 'Врач'}
                          </div>
                        )}
                        {!promo.clinic && !promo.doctor && (
                          <span className="text-slate-500 text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={promo.active && !isExpired(promo.valid_until) ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleActiveMutation.mutate({ id: promo.id, active: !promo.active })}
                      >
                        {isExpired(promo.valid_until) ? 'Истекла' : promo.active ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-slate-400 hover:text-white"
                          onClick={() => handleEdit(promo)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => deleteMutation.mutate(promo.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
    </>
  );
}
