import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Loader2, Package, Pencil, Plus, Search, Store, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { marketplace } from "@/lib/marketplace";

interface Product {
  id: string;
  supplier_id: string;
  type: "product" | "service";
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
  brand: string | null;
  unit: string | null;
  price: number;
  currency: string;
  stock_quantity: number | null;
  min_quantity: number | null;
  expiry_date: string | null;
  batch_number: string | null;
  image_url: string | null;
  images: string[] | null;
  is_active: boolean;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_reason?: string | null;
}

type Draft = Partial<Product>;

const MAX_PHOTOS = 5;

// `images` arrives from the proxy as an array, a stringified array, or null;
// fall back to the single image_url. Returns a clean array capped at MAX_PHOTOS.
function toPhotoArray(images: unknown, imageUrl?: string | null): string[] {
  let arr: string[] = [];
  if (Array.isArray(images)) arr = images as string[];
  else if (typeof images === "string" && images.trim().startsWith("[")) {
    try { arr = JSON.parse(images); } catch { arr = []; }
  }
  arr = (arr || []).filter((s): s is string => typeof s === "string" && !!s);
  if (!arr.length && imageUrl) arr = [imageUrl];
  return arr.slice(0, MAX_PHOTOS);
}

const UNIT_OPTIONS = ["шт", "упаковка", "набор", "коробка", "пара", "флакон", "ампула", "карпула", "мл", "л", "г", "кг", "м", "рулон", "услуга"];

// Common dental-supply categories, offered as suggestions in the combobox.
const DENTAL_CATEGORIES = [
  "Анестезия",
  "Пломбировочные материалы",
  "Адгезивы и бонды",
  "Цементы",
  "Слепочные материалы",
  "Эндодонтия",
  "Эндодонтические инструменты",
  "Ортодонтия",
  "Ортопедия и протезирование",
  "Имплантология",
  "Хирургия",
  "Профилактика и гигиена",
  "Отбеливание",
  "Боры и фрезы",
  "Инструменты",
  "Матрицы, клинья, коффердам",
  "Слюноотсосы и аспирация",
  "Дезинфекция и стерилизация",
  "Рентген и радиовизиография",
  "CAD/CAM",
  "Гипсы и моделирование",
  "Оборудование",
  "Расходные материалы",
  "Перчатки и СИЗ",
];

const newDraft = (supplierId: string): Draft => ({
  supplier_id: supplierId,
  type: "product",
  name: "",
  category: "",
  sku: "",
  brand: "",
  unit: "шт",
  price: 0,
  currency: "UZS",
  stock_quantity: null,
  min_quantity: null,
  expiry_date: null,
  batch_number: "",
  description: "",
  image_url: "",
  images: [],
});

const fieldCls =
  "h-11 w-full rounded-[10px] border border-border bg-background px-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({ label, children, hint, col }: { label: string; children: React.ReactNode; hint?: string; col?: boolean }) {
  return (
    <label className={cn("block", col && "sm:col-span-2")}>
      <span className="mb-1 block text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>}
    </label>
  );
}

/**
 * Free-text combobox that, unlike a native <datalist>, always lets you reopen
 * the FULL option list (the chevron) even when the current value exactly
 * matches an option — so you can re-pick after selecting. Typing still filters,
 * and any custom value is allowed.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = (value || "").toLowerCase().trim();
  // Filter only while the user is actively typing; once a value is set (or the
  // list is opened via the chevron), show every option so it can be re-picked.
  const list = typing && q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open || list.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((current) => Math.min(Math.max(current, 0), list.length - 1));
  }, [list.length, open]);

  const selectOption = (option: string) => {
    onChange(option);
    setTyping(false);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={ref} className="relative">
      <input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        value={value ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
          setTyping(true);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, list.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.max(current <= 0 ? list.length - 1 : current - 1, 0));
          } else if (event.key === "Enter" && open && activeIndex >= 0 && list[activeIndex]) {
            event.preventDefault();
            selectOption(list[activeIndex]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        placeholder={placeholder}
        className={fieldCls + " pr-9"}
      />
      <button
        type="button"
        aria-label="Показать варианты"
        aria-expanded={open}
        aria-controls={listboxId}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setTyping(false);
          setOpen((o) => !o);
          setActiveIndex(0);
        }}
        className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
      </button>
      {open && list.length > 0 && (
        <div id={listboxId} className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-[10px] border border-border bg-popover py-1 text-popover-foreground shadow-lg" role="listbox">
          {list.map((o, index) => (
            <button
              type="button"
              key={o}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={o === value}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(o)}
              className={cn(
                "block min-h-11 w-full px-3 py-2 text-left text-[13px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                (o === value || activeIndex === index) && "bg-primary/10 font-medium text-primary"
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDialog({
  open,
  draft,
  categories,
  onClose,
  onSaved,
}: {
  open: boolean;
  draft: Draft | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initForm = (d: Draft | null) => (d ? { ...d, images: toPhotoArray(d.images, d.image_url) } : {});
  const [form, setForm] = useState<Draft>(() => initForm(draft));
  const [nameTouched, setNameTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setForm(initForm(draft));
    setNameTouched(false);
  }, [draft]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  if (!open || !draft) return null;

  const isService = (form.type || "product") === "service";
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setForm((current) => ({ ...current, [key]: value }));
  const num = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

  // Photo gallery (up to MAX_PHOTOS). The first photo is the main one (image_url).
  const photos = (form.images as string[]) || [];
  const setPhotos = (next: string[]) =>
    setForm((f) => ({ ...f, images: next.slice(0, MAX_PHOTOS), image_url: next[0] || null }));

  const uploadPhotos = async (files: FileList) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { toast.error(`Максимум ${MAX_PHOTOS} фото`); return; }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${form.supplier_id || "misc"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { data, error } = await supabase.storage.from("marketplace").upload(path, file);
        if (error) throw error;
        const { data: pub } = supabase.storage.from("marketplace").getPublicUrl(data.path);
        // marketplace is a PUBLIC bucket — store the clean URL without the ?token=… query.
        urls.push((pub.publicUrl || "").split("?")[0]);
      }
      setPhotos([...photos, ...urls]);
      toast.success(urls.length > 1 ? `Загружено фото: ${urls.length}` : "Фото загружено");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = (idx: number) => setPhotos(photos.filter((_, i) => i !== idx));
  const makeMain = (idx: number) => {
    if (idx === 0) return;
    setPhotos([photos[idx], ...photos.filter((_, i) => i !== idx)]);
  };
  const addUrl = () => {
    const u = urlInput.trim();
    if (!u) return;
    if (photos.length >= MAX_PHOTOS) { toast.error(`Максимум ${MAX_PHOTOS} фото`); return; }
    setPhotos([...photos, u]);
    setUrlInput("");
  };

  const save = async () => {
    if (!form.supplier_id) return toast.error("Сначала загрузите витрину");
    if (!form.name?.trim()) {
      setNameTouched(true);
      return toast.error("Укажите название");
    }
    setSaving(true);
    const payload = {
      type: form.type || "product",
      name: form.name.trim(),
      description: form.description?.trim() || null,
      category: form.category?.trim() || null,
      sku: form.sku?.trim() || null,
      brand: form.brand?.trim() || null,
      unit: form.unit || null,
      price: Number(form.price) || 0,
      currency: "UZS",
      stock_quantity: isService ? null : num(form.stock_quantity),
      min_quantity: isService ? null : num(form.min_quantity),
      expiry_date: isService ? null : form.expiry_date || null,
      batch_number: isService ? null : form.batch_number?.trim() || null,
      images: photos,
      image_url: photos[0] || form.image_url || null,
    };
    try {
      if (form.id) {
        await marketplace.updateProduct(form.id, payload);
        toast.success("Товар обновлён");
      } else {
        await marketplace.createProduct(payload);
        toast.success("Товар добавлен");
      }
      onSaved();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!form.supplier_id && !!form.name?.trim() && !saving && !uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seller-product-dialog-title"
        aria-describedby="seller-product-dialog-description"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-[640px] overflow-y-auto rounded-[16px] bg-card text-card-foreground shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <div id="seller-product-dialog-title" className="text-[16px] font-bold font-display">{form.id ? "Редактировать позицию" : "Новый товар / услуга"}</div>
          <p id="seller-product-dialog-description" className="sr-only">Заполните информацию о товаре и сохраните изменения.</p>
          <button type="button" aria-label="Закрыть" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Type toggle */}
          <div className="flex gap-2">
            {(["product", "service"] as const).map((tp) => (
              <button
                key={tp}
                onClick={() => set("type", tp)}
                className={cn(
                  "min-h-11 flex-1 rounded-[10px] px-2 text-[13px] font-medium ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  (form.type || "product") === tp
                    ? "bg-[hsl(var(--brand-50))] text-[hsl(var(--brand-700))] ring-[hsl(var(--brand-100))]"
                    : "bg-card text-muted-foreground ring-border hover:bg-muted"
                )}
              >
                {tp === "product" ? "Товар" : "Услуга"}
              </button>
            ))}
          </div>

          {/* Photos (up to 5) */}
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted-foreground">
              Фото <span className="font-normal text-muted-foreground">(до {MAX_PHOTOS} · первое — главное)</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => e.target.files?.length && uploadPhotos(e.target.files)} />
            <div className="flex flex-wrap gap-2.5">
              {photos.map((src, i) => (
                <div key={src.slice(0, 24) + i} className="relative h-24 w-24">
                  <button
                    type="button"
                    onClick={() => makeMain(i)}
                    title={i === 0 ? "Главное фото" : "Сделать главным"}
                    className={cn(
                      "h-24 w-24 overflow-hidden rounded-[12px] border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      i === 0 ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary",
                    )}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                  {i === 0 && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[12px] font-semibold text-primary-foreground">Главное</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label={`Удалить фото ${i + 1}`}
                    className="absolute -right-2 -top-2 grid h-11 w-11 place-items-center rounded-full bg-destructive text-destructive-foreground shadow hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Добавить фотографии"
                  className="grid h-24 w-24 place-items-center rounded-[12px] border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <span className="flex flex-col items-center gap-1"><Upload className="h-5 w-5" aria-hidden="true" /><span className="text-[12px]">Добавить</span></span>
                  )}
                </button>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }}
                placeholder="или вставьте ссылку https://…"
                aria-label="Ссылка на фотографию"
                className="h-11 flex-1 rounded-[10px] border border-border bg-background px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={addUrl}
                disabled={!urlInput.trim() || photos.length >= MAX_PHOTOS}
                className="inline-flex h-11 items-center gap-1 rounded-[10px] border border-border bg-card px-3 text-[12.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Добавить
              </button>
            </div>
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Название *" col>
              <input
                id="seller-product-name"
                autoFocus
                required
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => setNameTouched(true)}
                aria-invalid={nameTouched && !form.name?.trim()}
                aria-describedby={nameTouched && !form.name?.trim() ? "seller-product-name-error" : undefined}
                placeholder="Например: Композит Filtek Z550 A2"
                className={fieldCls}
              />
              {nameTouched && !form.name?.trim() && (
                <span id="seller-product-name-error" className="mt-1 block text-xs text-destructive" role="alert">
                  Укажите название
                </span>
              )}
            </Field>

            <Field label="Категория">
              <Combobox value={form.category ?? ""} onChange={(v) => set("category", v)} options={categories} placeholder="напр. Расходники" />
            </Field>
            <Field label="Бренд">
              <input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} className={fieldCls} />
            </Field>

            <Field label="Артикул (SKU)">
              <input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} className={fieldCls} />
            </Field>
            <Field label="Ед. изм.">
              <Combobox value={form.unit ?? ""} onChange={(v) => set("unit", v)} options={UNIT_OPTIONS} />
            </Field>

            <Field label="Цена, сум" hint={Number(form.price) > 0 ? `${Number(form.price).toLocaleString("ru-RU")} сум` : undefined}>
              <input type="number" min={0} value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} className={fieldCls} />
            </Field>
            {!isService && (
              <Field label="Остаток">
                <input type="number" min={0} value={form.stock_quantity ?? ""} onChange={(e) => set("stock_quantity", e.target.value)} className={fieldCls} />
              </Field>
            )}

            {!isService && (
              <>
                <Field label="Мин. остаток" hint="Порог уведомления о низком остатке">
                  <input type="number" min={0} value={form.min_quantity ?? ""} onChange={(e) => set("min_quantity", e.target.value)} className={fieldCls} />
                </Field>
                <Field label="Срок годности">
                  <input type="date" value={form.expiry_date ? String(form.expiry_date).slice(0, 10) : ""} onChange={(e) => set("expiry_date", e.target.value)} className={fieldCls} />
                </Field>
                <Field label="Номер партии" col>
                  <input value={form.batch_number ?? ""} onChange={(e) => set("batch_number", e.target.value)} placeholder="напр. LOT-2026-0042" className={fieldCls} />
                </Field>
              </>
            )}

            <Field label="Описание" col>
              <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3}
                className="w-full rounded-[10px] border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-card px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-[10px] border border-border px-4 text-[13.5px] font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Отмена</button>
          <button onClick={save} disabled={!canSave}
            aria-busy={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SellerProducts() {
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [hasSupplier, setHasSupplier] = useState<boolean | null>(null);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Draft | null>(null);

  const loadSupplier = async () => {
    if (!user?.id) {
      setHasSupplier(null);
      setSupplierId(null);
      setLoadError("Не удалось определить пользователя.");
      return null;
    }
    setLoadError(null);
    try {
      const data = (await marketplace.getMySupplier()) as { id: string } | null;
      setHasSupplier(!!data);
      setSupplierId(data?.id ?? null);
      return data?.id ?? null;
    } catch {
      setSupplierId(null);
      setLoadError("Не удалось загрузить витрину. Проверьте соединение и попробуйте снова.");
      return null;
    }
  };

  const loadProducts = async (_sid: string) => {
    try {
      setItems((await marketplace.listMyProducts()) as unknown as Product[]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить товары.";
      toast.error(message);
      setLoadError(message);
    }
  };

  const refresh = async () => {
    setLoading(true);
    const sid = await loadSupplier();
    if (sid) await loadProducts(sid);
    else setItems([]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const remove = async (p: Product) => {
    if (!confirm(`Удалить «${p.name}» из каталога?`)) return;
    try {
      await marketplace.deleteProduct(p.id);
      toast.success("Удалено");
      setItems((arr) => arr.filter((x) => x.id !== p.id));
    } catch {
      toast.error("Не удалось удалить");
    }
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false) || (p.category?.toLowerCase().includes(q) ?? false)
    );
  }, [items, query]);

  const categoryOptions = useMemo(
    // Curated dental categories first, then any custom ones already in use.
    () => Array.from(new Set([...DENTAL_CATEGORIES, ...(items.map((p) => p.category).filter(Boolean) as string[])])),
    [items]
  );

  return (
    <SellerLayout title="Товары и услуги" subtitle={`${items.length} позиций в каталоге`}>
      <div className="mx-auto max-w-[1320px] space-y-4 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">Загрузка товаров</span>
          </div>
        ) : loadError ? (
          <Card className="border-destructive/30 bg-destructive/10 px-5 py-10 text-center" role="alert">
            <p className="text-[14px] font-medium text-foreground">{loadError}</p>
            <button type="button" onClick={refresh} className="mt-4 h-11 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Повторить
            </button>
          </Card>
        ) : hasSupplier === false ? (
          <Card className="py-16 text-center">
            <div className="w-12 h-12 rounded-[12px] mx-auto bg-[hsl(var(--brand-50))] grid place-items-center text-[hsl(var(--brand-700))] mb-4">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-[18px] font-bold font-display">Сначала создайте витрину</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-muted-foreground">
              Чтобы публиковать товары, заполните публичный профиль компании.
            </p>
            <Link
              to="/seller/profile"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Перейти к витрине
            </Link>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию, артикулу, категории…"
                  aria-label="Поиск товаров"
                  className="h-11 w-full rounded-[10px] border border-border bg-background pl-9 pr-3 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <button
                type="button"
                onClick={() => setDialog(newDraft(supplierId!))}
                disabled={!supplierId}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-[13.5px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ boxShadow: "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)" }}
              >
                <Plus className="h-4 w-4" /> Добавить
              </button>
            </div>

            <div
              className="max-w-full overflow-x-auto rounded-[14px] border border-border bg-card text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              role="region"
              aria-label="Таблица товаров"
              tabIndex={0}
            >
              <table className="min-w-[720px] w-full text-[13px]">
                <caption className="sr-only">Товары и услуги продавца</caption>
                <thead className="bg-muted">
                  <tr className="text-left text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-3">Позиция</th>
                    <th scope="col" className="px-3 py-3">Категория</th>
                    <th scope="col" className="px-3 py-3 text-right">Цена</th>
                    <th scope="col" className="px-3 py-3 text-right">Остаток</th>
                    <th scope="col" className="px-3 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center">
                        <Package className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <div className="text-[14px] font-medium text-foreground" role="status">
                          {items.length === 0 ? "Каталог пуст" : "Ничего не найдено"}
                        </div>
                        <div className="mt-1 text-[12.5px] text-muted-foreground">
                          {items.length === 0 ? 'Добавьте первую позицию через "Добавить"' : "Измените поисковый запрос"}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id} className="border-t border-border hover:bg-muted/60">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[8px] bg-muted text-muted-foreground">
                              {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-semibold text-foreground">{p.name}</div>
                              <div className="text-[12px] text-muted-foreground">
                                {p.type === "service" ? "Услуга" : "Товар"}
                                {p.brand ? ` · ${p.brand}` : ""}
                                {p.sku ? ` · ${p.sku}` : ""}
                              </div>
                              <div className={`mt-1 text-[12px] font-medium ${
                                p.moderation_status === "approved"
                                  ? "text-[hsl(var(--success-green))]"
                                  : p.moderation_status === "rejected"
                                    ? "text-destructive"
                                    : "text-[hsl(var(--warning-amber))]"
                              }`}>
                                {p.moderation_status === "approved"
                                  ? "Опубликован"
                                  : p.moderation_status === "rejected"
                                    ? `Отклонён${p.moderation_reason ? `: ${p.moderation_reason}` : ""}`
                                    : "На проверке"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{p.category || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold text-foreground">
                          {Number(p.price).toLocaleString("ru-RU")}{" "}
                          <span className="text-[12px] font-normal text-muted-foreground">{p.currency === "UZS" ? "сум" : p.currency}/{p.unit || "шт"}</span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-foreground">
                          {p.type === "service" ? "—" : p.stock_quantity ?? 0}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" aria-label={`Редактировать ${p.name}`} onClick={() => setDialog(p)} className="grid h-11 w-11 place-items-center rounded-[8px] text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" aria-label={`Удалить ${p.name}`} onClick={() => remove(p)} className="grid h-11 w-11 place-items-center rounded-[8px] text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <ProductDialog open={!!dialog} draft={dialog} categories={categoryOptions} onClose={() => setDialog(null)} onSaved={() => supplierId && loadProducts(supplierId)} />
    </SellerLayout>
  );
}
