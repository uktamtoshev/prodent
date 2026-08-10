import { lazy, Suspense, useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, Calendar, Percent, Building2, User, Upload, Image as ImageIcon, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

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

interface PromotionClinic { id: string; name: string }
interface PromotionDoctor { id: string; user_id?: string; profiles?: { full_name?: string | null } | null }
interface Promotion extends PromotionForm {
  id: string;
  clinic?: PromotionClinic | null;
  doctor?: PromotionDoctor | null;
}

const AvatarCropper = lazy(() =>
  import('@/components/ui/avatar-cropper').then((module) => ({ default: module.AvatarCropper })),
);

const mutationError = (error: unknown) => error instanceof Error ? error.message : String(error);

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
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionForm>(initialForm);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const categories = useMemo(() => [
    { value: 'whitening', label: t('adminPromotions.catWhitening') },
    { value: 'cleaning', label: t('adminPromotions.catCleaning') },
    { value: 'implants', label: t('adminPromotions.catImplants') },
    { value: 'braces', label: t('adminPromotions.catBraces') },
    { value: 'prosthetics', label: t('adminPromotions.catProsthetics') },
    { value: 'treatment', label: t('adminPromotions.catTreatment') },
    { value: 'extraction', label: t('adminPromotions.catExtraction') },
    { value: 'kids', label: t('adminPromotions.catKids') },
    { value: 'other', label: t('adminPromotions.catOther') },
  ], [t]);

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
      return (data || []) as Promotion[];
    },
  });

  const { data: clinics } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('id, name').order('name');
      return (data || []) as PromotionClinic[];
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id, user_id, profiles:user_id(full_name)')
        .order('created_at', { ascending: false });
      return (data || []) as PromotionDoctor[];
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('admin.selectImage'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('admin.fileSizeExceeded'));
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

      // Strip the `?token=<jwt>` the storage shim appends: `promotions` is a public bucket,
      // so the image renders without it — and persisting the admin's short-lived JWT into a
      // public table both leaks the token and breaks the image once the token expires.
      const cleanUrl = publicUrl.split('?')[0];

      // Create preview from blob
      const previewUrl = URL.createObjectURL(croppedBlob);
      setPreviewImage(previewUrl);
      setForm({ ...form, image_url: cleanUrl });
      toast.success(t('admin.imageUploaded'));
    } catch (error: unknown) {
      toast.error(t('admin.uploadError') + mutationError(error));
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
      toast.success(t('adminPromotions.created'));
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(t('adminPromotions.errorPrefix') + mutationError(error));
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
      toast.success(t('adminPromotions.updated'));
      resetForm();
    },
    onError: (error: unknown) => {
      toast.error(t('adminPromotions.errorPrefix') + mutationError(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success(t('adminPromotions.deleted'));
      setDeleteId(null);
    },
    onError: (error: unknown) => {
      toast.error(t('adminPromotions.errorPrefix') + mutationError(error));
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('promotions').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      toast.success(t('adminPromotions.statusChanged'));
    },
    onError: (error: unknown) => {
      toast.error(t('adminPromotions.errorPrefix') + mutationError(error));
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

  const handleEdit = (promo: Promotion) => {
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
    if (!form.title || !form.description.trim() || form.price <= 0 || !form.valid_until || !form.category) {
      toast.error(t('adminPromotions.fillRequired'));
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
    return new Intl.NumberFormat('uz-UZ').format(price) + ' ' + t('admin.sumCurrency');
  };

  // Get clinic/doctor name for preview
  const getClinicName = () => {
    if (form.clinic_id) {
      return clinics?.find(c => c.id === form.clinic_id)?.name || t('adminPromotions.clinicFallback');
    }
    return null;
  };

  const getDoctorName = () => {
    if (form.doctor_id) {
      const doc = doctors?.find(d => d.id === form.doctor_id);
      return doc?.profiles?.full_name || t('adminPromotions.doctorFallback');
    }
    return null;
  };

  return (
    <>
      {/* Image Cropper Modal */}
      {tempImageSrc && (
        <Suspense fallback={null}>
          <AvatarCropper
            open={cropperOpen}
            onClose={handleCropperClose}
            imageSrc={tempImageSrc}
            onCropComplete={handleCropComplete}
            aspectRatio={16 / 9}
            circularCrop={false}
          />
        </Suspense>
      )}

      <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('adminPromotions.title')}</h1>
            <p className="text-muted-foreground mt-2">{t('adminPromotions.subtitle')}</p>
          </div>
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-[#00C6BB] hover:bg-[#00C6BB]/90">
                <Plus className="h-4 w-4" />
                {t('adminPromotions.btnCreate')}
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-foreground max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? t('adminPromotions.dialogEdit') : t('adminPromotions.dialogNew')}</DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Form Section */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">{t('adminPromotions.labelTitle')} *</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder={t('adminPromotions.placeholderTitle')}
                      className="bg-muted border-border"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">{t('adminPromotions.labelDescription')} *</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder={t('adminPromotions.placeholderDescription')}
                      className="bg-muted border-border min-h-[80px]"
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <Label>{t('adminPromotions.labelImage')}</Label>
                    <div className="mt-2">
                      {(previewImage || form.image_url) ? (
                        <div className="relative inline-block">
                          <img
                            src={previewImage || form.image_url}
                            alt="Preview"
                            className="w-full max-w-[200px] h-32 object-cover rounded-lg border border-border"
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
                          className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-foreground/30 transition-colors"
                        >
                          {uploading ? (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <div className="animate-spin h-5 w-5 border-2 border-border border-t-transparent rounded-full" />
                              {t('admin.uploading')}
                            </div>
                          ) : (
                            <>
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                              <p className="text-muted-foreground text-sm">{t('admin.uploadHint')}</p>
                              <p className="text-muted-foreground text-xs mt-1">{t('admin.uploadHintExt')}</p>
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
                      <Label htmlFor="category">{t('adminPromotions.labelCategory')} *</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                        <SelectTrigger className="bg-muted border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-muted border-border">
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="discount">{t('adminPromotions.labelDiscount')}</Label>
                      <Input
                        id="discount"
                        type="number"
                        value={form.discount}
                        onChange={(e) => setForm({ ...form, discount: parseInt(e.target.value) || 0 })}
                        placeholder="30"
                        className="bg-muted border-border"
                      />
                    </div>

                    <div>
                      <Label htmlFor="old_price">{t('adminPromotions.labelOldPrice')}</Label>
                      <Input
                        id="old_price"
                        type="number"
                        value={form.old_price}
                        onChange={(e) => setForm({ ...form, old_price: parseInt(e.target.value) || 0 })}
                        placeholder="1000000"
                        className="bg-muted border-border"
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">{t('adminPromotions.labelNewPrice')} *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={form.price}
                        onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                        placeholder="700000"
                        className="bg-muted border-border"
                      />
                    </div>

                    <div>
                      <Label htmlFor="valid_until">{t('adminPromotions.labelValidUntil')} *</Label>
                      <Input
                        id="valid_until"
                        type="date"
                        value={form.valid_until}
                        onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                        className="bg-muted border-border"
                      />
                    </div>

                    <div>
                      <Label htmlFor="clinic">{t('adminPromotions.labelClinic')}</Label>
                      <Select
                        value={form.clinic_id || 'none'}
                        onValueChange={(v) => setForm({ ...form, clinic_id: v === 'none' ? null : v })}
                      >
                        <SelectTrigger className="bg-muted border-border">
                          <SelectValue placeholder={t('adminPromotions.placeholderSelectClinic')} />
                        </SelectTrigger>
                        <SelectContent className="bg-muted border-border">
                          <SelectItem value="none">{t('adminPromotions.noneOption')}</SelectItem>
                          {clinics?.map((clinic) => (
                            <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="doctor">{t('adminPromotions.labelDoctor')}</Label>
                    <Select
                      value={form.doctor_id || 'none'}
                      onValueChange={(v) => setForm({ ...form, doctor_id: v === 'none' ? null : v })}
                    >
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue placeholder={t('adminPromotions.placeholderSelectDoctor')} />
                      </SelectTrigger>
                      <SelectContent className="bg-muted border-border">
                        <SelectItem value="none">{t('adminPromotions.noneOption')}</SelectItem>
                        {doctors?.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.profiles?.full_name || t('adminPromotions.doctorFallback')}
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
                    {editingId ? t('adminPromotions.btnSave') : t('adminPromotions.btnCreateAction')}
                  </Button>
                </div>

                {/* Live Preview Section */}
                <div className="space-y-4">
                  <Label className="text-muted-foreground">{t('adminPromotions.previewLabel')}</Label>
                  <div className="bg-muted rounded-xl border border-border overflow-hidden">
                    {/* Preview Card */}
                    <div className="relative">
                      {(previewImage || form.image_url) ? (
                        <img
                          src={previewImage || form.image_url}
                          alt="Preview"
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted flex items-center justify-center">
                          <ImageIcon className="h-12 w-12 text-muted-foreground" />
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
                        <Badge variant="outline" className="text-muted-foreground border-border text-xs">
                          {categories.find(c => c.value === form.category)?.label || t('adminPromotions.previewCategory')}
                        </Badge>
                      </div>

                      <h3 className="text-foreground font-semibold text-lg line-clamp-2">
                        {form.title || t('adminPromotions.previewTitleFallback')}
                      </h3>

                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {form.description || t('adminPromotions.previewDescFallback')}
                      </p>

                      <div className="flex items-baseline gap-2">
                        <span className="text-[#00C6BB] text-xl font-bold">
                          {form.price > 0 ? formatPrice(form.price) : `0 ${t('admin.sumCurrency')}`}
                        </span>
                        {form.old_price > 0 && (
                          <span className="text-muted-foreground line-through text-sm">
                            {formatPrice(form.old_price)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{t('adminPromotions.validUntilPrefix')} {formatDate(form.valid_until)}</span>
                        </div>
                      )}

                      <Button className="w-full bg-[#00C6BB] hover:bg-[#00C6BB]/90 mt-2">
                        {t('adminPromotions.bookBtn')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminPromotions.colTitle')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colCategory')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colDiscount')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colPrice')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colValidUntil')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colBinding')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminPromotions.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : promotions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {t('adminPromotions.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                promotions?.map((promo) => (
                  <TableRow key={promo.id} className="border-border hover:bg-accent/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {promo.image_url ? (
                          <img
                            src={promo.image_url}
                            alt=""
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="text-foreground font-medium">{promo.title}</div>
                          <div className="text-muted-foreground text-sm truncate max-w-[200px]">
                            {promo.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-muted-foreground">
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
                      <div className="text-foreground">{formatPrice(promo.price)}</div>
                      {promo.old_price > 0 && (
                        <div className="text-muted-foreground text-sm line-through">
                          {formatPrice(promo.old_price)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${isExpired(promo.valid_until) ? 'text-red-400' : 'text-muted-foreground'}`}>
                        <Calendar className="h-4 w-4" />
                        {formatDate(promo.valid_until)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {promo.clinic && (
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Building2 className="h-3 w-3" />
                            {promo.clinic.name}
                          </div>
                        )}
                        {promo.doctor && (
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <User className="h-3 w-3" />
                            {promo.doctor.profiles?.full_name || t('adminPromotions.doctorFallback')}
                          </div>
                        )}
                        {!promo.clinic && !promo.doctor && (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={promo.active && !isExpired(promo.valid_until) ? 'default' : 'secondary'}
                      >
                        {isExpired(promo.valid_until) ? t('adminPromotions.statusExpired') : promo.active ? t('adminPromotions.statusActive') : t('adminPromotions.statusInactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!promo.active}
                          disabled={toggleActiveMutation.isPending}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: promo.id, active: checked })}
                          aria-label={t('adminPromotions.colStatus')}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(promo)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => setDeleteId(promo.id)}
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

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить акцию?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Акция будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t('admin.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600"
            >
              {t('admin.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
    </>
  );
}
