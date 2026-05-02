import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Calendar, Image as ImageIcon, Star, Sparkles, Upload, X, Loader2 } from 'lucide-react';

export const PROMOTION_CATEGORIES = [
  { value: 'whitening',   label: 'Отбеливание' },
  { value: 'cleaning',    label: 'Чистка / гигиена' },
  { value: 'implants',    label: 'Имплантация' },
  { value: 'braces',      label: 'Брекеты' },
  { value: 'aligners',    label: 'Элайнеры' },
  { value: 'prosthetics', label: 'Протезирование' },
  { value: 'treatment',   label: 'Лечение' },
  { value: 'extraction',  label: 'Удаление' },
  { value: 'kids',        label: 'Детская стоматология' },
  { value: 'aesthetics',  label: 'Эстетика' },
  { value: 'surgery',     label: 'Хирургия' },
  { value: 'periodontics', label: 'Пародонтология' },
  { value: 'consult',     label: 'Консультация' },
  { value: 'other',       label: 'Другое' },
];

export const STATUS_OPTIONS = [
  { value: 'DRAFT',    label: 'Черновик',   color: 'bg-slate-700 text-slate-200' },
  { value: 'ACTIVE',   label: 'Активна',    color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  { value: 'PAUSED',   label: 'На паузе',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  { value: 'EXPIRED',  label: 'Истекла',    color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { value: 'ARCHIVED', label: 'В архиве',   color: 'bg-slate-800 text-slate-400' },
];

const TARGET_AUDIENCES = [
  { value: 'ALL',           label: 'Все пациенты' },
  { value: 'NEW_PATIENTS',  label: 'Новые пациенты' },
  { value: 'RETURNING',     label: 'Постоянные пациенты' },
];

const COMMON_CITIES = [
  'Tashkent', 'Samarkand', 'Bukhara', 'Andijan', 'Namangan',
  'Fergana', 'Khiva', 'Qarshi', 'Nukus', 'Termez',
];

interface PromotionFormState {
  title: string;
  title_uz: string;
  title_en: string;
  description: string;
  description_uz: string;
  description_en: string;
  terms: string;
  image_url: string;
  badge_label: string;
  cta_label: string;
  category: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount: number;
  discount_amount: number | null;
  price: number;
  old_price: number;
  currency: string;
  clinic_id: string | null;
  doctor_id: string | null;
  target_cities: string[];
  target_audience: string;
  valid_from: string;
  valid_until: string;
  status: string;
  active: boolean;
  is_featured: boolean;
  priority: number;
  max_impressions: number | null;
  max_bookings: number | null;
}

const initial: PromotionFormState = {
  title: '',
  title_uz: '',
  title_en: '',
  description: '',
  description_uz: '',
  description_en: '',
  terms: '',
  image_url: '',
  badge_label: '',
  cta_label: '',
  category: 'other',
  discount_type: 'PERCENT',
  discount: 0,
  discount_amount: null,
  price: 0,
  old_price: 0,
  currency: 'UZS',
  clinic_id: null,
  doctor_id: null,
  target_cities: [],
  target_audience: 'ALL',
  valid_from: '',
  valid_until: '',
  status: 'DRAFT',
  active: true,
  is_featured: false,
  priority: 0,
  max_impressions: null,
  max_bookings: null,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingId: string | null;
  initialData?: any;
}

export function PromotionFormDialog({ open, onOpenChange, editingId, initialData }: Props) {
  const [form, setForm] = useState<PromotionFormState>(initial);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Пожалуйста, выберите изображение');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Файл не должен превышать 10 МБ');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('prodent_access_token');
      const res = await fetch('/api/v1/admin/uploads/promotions', {
        method: 'POST',
        body: fd,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message ?? err?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setForm((f) => ({ ...f, image_url: json.url }));
      toast.success('Изображение загружено');
    } catch (e: any) {
      toast.error('Ошибка загрузки: ' + (e?.message ?? 'unknown'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (initialData && editingId) {
      setForm({
        title: initialData.title ?? '',
        title_uz: initialData.title_uz ?? '',
        title_en: initialData.title_en ?? '',
        description: initialData.description ?? '',
        description_uz: initialData.description_uz ?? '',
        description_en: initialData.description_en ?? '',
        terms: initialData.terms ?? '',
        image_url: initialData.image_url ?? '',
        badge_label: initialData.badge_label ?? '',
        cta_label: initialData.cta_label ?? '',
        category: initialData.category ?? 'other',
        discount_type: initialData.discount_type ?? 'PERCENT',
        discount: Number(initialData.discount ?? 0),
        discount_amount: initialData.discount_amount ?? null,
        price: Number(initialData.price ?? 0),
        old_price: Number(initialData.old_price ?? 0),
        currency: initialData.currency ?? 'UZS',
        clinic_id: initialData.clinic_id ?? null,
        doctor_id: initialData.doctor_id ?? null,
        target_cities: initialData.target_cities ?? [],
        target_audience: initialData.target_audience ?? 'ALL',
        valid_from: initialData.valid_from?.slice(0, 10) ?? '',
        valid_until: initialData.valid_until?.slice(0, 10) ?? '',
        status: initialData.status ?? 'DRAFT',
        active: initialData.active ?? true,
        is_featured: initialData.is_featured ?? false,
        priority: Number(initialData.priority ?? 0),
        max_impressions: initialData.max_impressions ?? null,
        max_bookings: initialData.max_bookings ?? null,
      });
    } else if (open && !editingId) {
      setForm(initial);
    }
  }, [open, editingId, initialData]);

  const { data: clinics } = useQuery({
    queryKey: ['clinics-list'],
    queryFn: async () => {
      const { data } = await supabase.from('clinics').select('id, name').order('name');
      return data || [];
    },
    enabled: open,
  });

  const { data: doctors } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('doctors')
        .select('id, user_id, profiles:user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async (state: PromotionFormState) => {
      if (!state.title.trim()) throw new Error('Введите название');
      if (!state.valid_until)  throw new Error('Укажите дату окончания');
      if (!state.clinic_id && !state.doctor_id) throw new Error('Привяжите акцию к клинике или врачу');

      const payload: any = {
        title: state.title,
        title_uz: state.title_uz || null,
        title_en: state.title_en || null,
        description: state.description || null,
        description_uz: state.description_uz || null,
        description_en: state.description_en || null,
        terms: state.terms || null,
        image_url: state.image_url || null,
        badge_label: state.badge_label || null,
        cta_label: state.cta_label || null,
        category: state.category,
        discount_type: state.discount_type,
        discount: state.discount,
        discount_amount: state.discount_amount,
        price: state.price,
        old_price: state.old_price,
        currency: state.currency,
        clinic_id: state.clinic_id,
        doctor_id: state.doctor_id,
        target_cities: state.target_cities,
        target_audience: state.target_audience,
        valid_from: state.valid_from ? new Date(state.valid_from).toISOString() : new Date().toISOString(),
        valid_until: new Date(state.valid_until).toISOString(),
        status: state.status,
        active: state.active,
        is_featured: state.is_featured,
        priority: state.priority,
        max_impressions: state.max_impressions,
        max_bookings: state.max_bookings,
      };

      if (editingId) {
        const { error } = await supabase.from('promotions').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('promotions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promotions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-promotions-stats'] });
      toast.success(editingId ? 'Акция обновлена' : 'Акция создана');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error('Ошибка: ' + (e?.message ?? 'unknown')),
  });

  const toggleCity = (city: string) => {
    setForm((f) =>
      f.target_cities.includes(city)
        ? { ...f, target_cities: f.target_cities.filter((c) => c !== city) }
        : { ...f, target_cities: [...f.target_cities, city] },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {editingId ? 'Редактировать акцию' : 'Новая акция'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Акция отображается на главной странице как премиум-реклама. Заполняйте все вкладки —
            это влияет на конверсию.
          </DialogDescription>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <Tabs defaultValue="content">
            <TabsList className="bg-slate-800 grid grid-cols-5 w-full">
              <TabsTrigger value="content">Контент</TabsTrigger>
              <TabsTrigger value="pricing">Цена</TabsTrigger>
              <TabsTrigger value="targeting">Таргетинг</TabsTrigger>
              <TabsTrigger value="schedule">График</TabsTrigger>
              <TabsTrigger value="advanced">Реклама</TabsTrigger>
            </TabsList>

            {/* ── Content ── */}
            <TabsContent value="content" className="space-y-4 pt-4">
              <div>
                <Label>Название (RU) *</Label>
                <Input
                  className="bg-slate-800 border-slate-700"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Отбеливание Zoom со скидкой 30%"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Название (UZ)</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    value={form.title_uz}
                    onChange={(e) => setForm({ ...form, title_uz: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Название (EN)</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    value={form.title_en}
                    onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Описание (RU)</Label>
                <Textarea
                  className="bg-slate-800 border-slate-700 min-h-[100px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Описание (UZ)</Label>
                  <Textarea
                    className="bg-slate-800 border-slate-700"
                    value={form.description_uz}
                    onChange={(e) => setForm({ ...form, description_uz: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Описание (EN)</Label>
                  <Textarea
                    className="bg-slate-800 border-slate-700"
                    value={form.description_en}
                    onChange={(e) => setForm({ ...form, description_en: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Условия / fine print</Label>
                <Textarea
                  className="bg-slate-800 border-slate-700"
                  placeholder="Скидка не суммируется с другими акциями…"
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </div>

              <div>
                <Label>Изображение</Label>
                <div className="mt-2 space-y-2">
                  {form.image_url ? (
                    <div className="relative inline-block">
                      <img
                        src={form.image_url}
                        alt="preview"
                        className="w-full max-w-[280px] h-36 object-cover rounded-lg border border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: '' })}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        uploading
                          ? 'border-slate-700 cursor-wait'
                          : 'border-slate-700 hover:border-cyan-500/60 cursor-pointer'
                      }`}
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Загрузка…
                        </div>
                      ) : (
                        <>
                          <Upload className="h-7 w-7 mx-auto text-slate-500 mb-2" />
                          <p className="text-slate-300 text-sm">Нажмите для загрузки</p>
                          <p className="text-slate-500 text-xs mt-1">PNG, JPG, WEBP до 10 МБ</p>
                        </>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                  <Input
                    className="bg-slate-800 border-slate-700 text-xs"
                    placeholder="…или вставьте URL изображения"
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Категория *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      {PROMOTION_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Бейдж</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    placeholder="HOT, NEW, VIP"
                    maxLength={20}
                    value={form.badge_label}
                    onChange={(e) => setForm({ ...form, badge_label: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Текст кнопки</Label>
                  <Input
                    className="bg-slate-800 border-slate-700"
                    placeholder="Записаться"
                    maxLength={40}
                    value={form.cta_label}
                    onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ── Pricing ── */}
            <TabsContent value="pricing" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Тип скидки</Label>
                  <Select
                    value={form.discount_type}
                    onValueChange={(v: 'PERCENT' | 'FIXED') => setForm({ ...form, discount_type: v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="PERCENT">Процент (%)</SelectItem>
                      <SelectItem value="FIXED">Фикс. сумма</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Скидка %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="bg-slate-800 border-slate-700"
                    value={form.discount}
                    onChange={(e) =>
                      setForm({ ...form, discount: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })
                    }
                  />
                </div>
              </div>

              {form.discount_type === 'FIXED' && (
                <div>
                  <Label>Скидка (сумма)</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-slate-800 border-slate-700"
                    value={form.discount_amount ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, discount_amount: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Старая цена</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-slate-800 border-slate-700"
                    value={form.old_price}
                    onChange={(e) => setForm({ ...form, old_price: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Новая цена *</Label>
                  <Input
                    type="number"
                    min={0}
                    className="bg-slate-800 border-slate-700"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Валюта</Label>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm({ ...form, currency: v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="UZS">UZS — сум</SelectItem>
                      <SelectItem value="USD">USD — $</SelectItem>
                      <SelectItem value="RUB">RUB — ₽</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ── Targeting ── */}
            <TabsContent value="targeting" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Клиника
                  </Label>
                  <Select
                    value={form.clinic_id ?? 'none'}
                    onValueChange={(v) => setForm({ ...form, clinic_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Не выбрано" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-72">
                      <SelectItem value="none">— не привязано —</SelectItem>
                      {clinics?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Врач
                  </Label>
                  <Select
                    value={form.doctor_id ?? 'none'}
                    onValueChange={(v) => setForm({ ...form, doctor_id: v === 'none' ? null : v })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue placeholder="Не выбрано" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-72">
                      <SelectItem value="none">— не привязано —</SelectItem>
                      {doctors?.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.profiles?.full_name ?? 'Врач'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Должна быть выбрана как минимум одна сущность — клиника или врач.
              </p>

              <div>
                <Label>Целевая аудитория</Label>
                <Select
                  value={form.target_audience}
                  onValueChange={(v) => setForm({ ...form, target_audience: v })}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {TARGET_AUDIENCES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Города (пусто = все)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COMMON_CITIES.map((city) => {
                    const active = form.target_cities.includes(city);
                    return (
                      <button
                        type="button"
                        key={city}
                        onClick={() => toggleCity(city)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          active
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        {city}
                      </button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ── Schedule ── */}
            <TabsContent value="schedule" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Действует с</Label>
                  <Input
                    type="date"
                    className="bg-slate-800 border-slate-700"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Действует до *</Label>
                  <Input
                    type="date"
                    className="bg-slate-800 border-slate-700"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <Label className="text-base">Активная</Label>
                  <p className="text-xs text-slate-400">Показывать на лендинге</p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
            </TabsContent>

            {/* ── Advanced / Advertising ── */}
            <TabsContent value="advanced" className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <div>
                    <Label className="text-base">Featured (закрепить)</Label>
                    <p className="text-xs text-slate-400">Поднимает акцию в начало списка</p>
                  </div>
                </div>
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
              </div>

              <div>
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Приоритет (0–100)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="bg-slate-800 border-slate-700"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Чем выше число, тем раньше акция появляется в выдаче.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Лимит показов</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="∞ — без лимита"
                    className="bg-slate-800 border-slate-700"
                    value={form.max_impressions ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, max_impressions: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div>
                  <Label>Лимит записей</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="∞ — без лимита"
                    className="bg-slate-800 border-slate-700"
                    value={form.max_bookings ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, max_bookings: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* ── Live preview ── */}
          <div>
            <Label className="text-slate-400 mb-2 block">Предпросмотр карточки</Label>
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden sticky top-2">
              <div className="relative h-44 bg-slate-800">
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-slate-700" />
                  </div>
                )}
                {form.is_featured && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                    <Star className="h-3 w-3" /> FEATURED
                  </div>
                )}
                {form.discount > 0 && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    -{form.discount}%
                  </div>
                )}
                {form.badge_label && (
                  <div className="absolute bottom-2 left-2 bg-cyan-500 text-black px-2 py-0.5 rounded text-xs font-bold">
                    {form.badge_label}
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                  {PROMOTION_CATEGORIES.find((c) => c.value === form.category)?.label ?? form.category}
                </Badge>
                <h3 className="text-white font-semibold text-base line-clamp-2">
                  {form.title || 'Название акции'}
                </h3>
                <p className="text-slate-400 text-xs line-clamp-2">
                  {form.description || 'Описание акции…'}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-cyan-400 text-lg font-bold">
                    {form.price > 0 ? `${form.price.toLocaleString('uz-UZ')} ${form.currency}` : '—'}
                  </span>
                  {form.old_price > 0 && (
                    <span className="text-slate-500 line-through text-xs">
                      {form.old_price.toLocaleString('uz-UZ')} {form.currency}
                    </span>
                  )}
                </div>
                {form.valid_until && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    до {new Date(form.valid_until).toLocaleDateString('ru-RU')}
                  </div>
                )}
                <Button size="sm" className="w-full bg-cyan-500 hover:bg-cyan-500/90 text-black">
                  {form.cta_label || 'Записаться'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            className="bg-cyan-500 hover:bg-cyan-500/90 text-black"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {saveMutation.isPending ? 'Сохранение…' : editingId ? 'Сохранить' : 'Создать акцию'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
