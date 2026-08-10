import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/system/StatePanel";
import { useAuth } from "@/contexts/AuthContext";
import { marketplace } from "@/lib/marketplace";

export interface MarketplaceSupplier {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  inn: string | null;
  delivery_terms: string | null;
  payment_terms: string | null;
  warehouse_address: string | null;
  rating: number;
  reviews_count: number;
  is_verified: boolean;
  is_active: boolean;
  moderation_status?: "pending" | "approved" | "rejected";
  moderation_reason?: string | null;
}

const FIELDS: { key: keyof MarketplaceSupplier; label: string; placeholder?: string; type?: string; textarea?: boolean; required?: boolean }[] = [
  { key: "name", label: "Название компании", placeholder: "Например: ДентСнаб", required: true },
  { key: "description", label: "Описание", placeholder: "Чем занимается компания, ассортимент, условия…", textarea: true },
  { key: "city", label: "Город", placeholder: "Ташкент" },
  { key: "address", label: "Адрес", placeholder: "ул. …, д. …" },
  { key: "warehouse_address", label: "Адрес склада", placeholder: "Откуда отгружаются заказы" },
  { key: "delivery_terms", label: "Условия доставки", placeholder: "Сроки, стоимость, зоны доставки…", textarea: true },
  { key: "payment_terms", label: "Условия оплаты", placeholder: "Способы оплаты, предоплата, отсрочка…", textarea: true },
  { key: "phone", label: "Телефон", placeholder: "+998 …", type: "tel" },
  { key: "email", label: "Email", placeholder: "sales@company.uz", type: "email" },
  { key: "website", label: "Сайт", placeholder: "https://…", type: "url" },
  { key: "inn", label: "ИНН", placeholder: "9 цифр" },
  { key: "logo_url", label: "Логотип (URL)", placeholder: "https://… .png", type: "url" },
];

const empty = (userId: string): Partial<MarketplaceSupplier> => ({
  user_id: userId,
  name: "",
  description: "",
  city: "",
  address: "",
  warehouse_address: "",
  delivery_terms: "",
  payment_terms: "",
  phone: "",
  email: "",
  website: "",
  inn: "",
  logo_url: "",
});

// Exported for the focused profile validation contract.
// eslint-disable-next-line react-refresh/only-export-components
export const validateSellerProfile = (
  value: Partial<MarketplaceSupplier>,
): Partial<Record<keyof MarketplaceSupplier, string>> =>
  value.name?.trim() ? {} : { name: "Укажите название компании" };

type SellerLoadState = "loading" | "error" | "notFound" | "ready";

const isConfirmedNotFound = (error: unknown) => {
  if (error instanceof Error && /^HTTP 404(?:\b|$)/.test(error.message)) return true;
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: unknown; statusCode?: unknown }).status
    ?? (error as { statusCode?: unknown }).statusCode;
  return status === 404;
};

export default function SellerProfile() {
  const { user } = useAuth();
  const [loadState, setLoadState] = useState<SellerLoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<MarketplaceSupplier | null>(null);
  const [form, setForm] = useState<Partial<MarketplaceSupplier>>(empty(user?.id ?? ""));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof MarketplaceSupplier, string>>>({});

  const load = async () => {
    if (!user?.id) {
      setSupplier(null);
      setLoadError("Не удалось определить пользователя.");
      setLoadState("error");
      return;
    }
    setLoadState("loading");
    setLoadError("");
    try {
      const data = (await marketplace.getMySupplier()) as MarketplaceSupplier | null;
      if (data) {
        setSupplier(data);
        setForm(data);
        setLoadState("ready");
      } else {
        setSupplier(null);
        setForm(empty(user.id));
        setLoadState("notFound");
      }
    } catch (error: unknown) {
      setSupplier(null);
      if (isConfirmedNotFound(error)) {
        setForm(empty(user.id));
        setLoadState("notFound");
        return;
      }
      setLoadError(error instanceof Error ? error.message : "Проверьте интернет и попробуйте снова.");
      setLoadState("error");
      toast.error("Не удалось загрузить витрину");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setField = (key: keyof MarketplaceSupplier, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    if (!user?.id || (loadState !== "ready" && loadState !== "notFound")) return;
    const errors = validateSellerProfile(form);
    if (errors.name) {
      setFieldErrors(errors);
      toast.error("Укажите название компании");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    // Only send writable columns — rating / is_verified / reviews_count and
    // user_id are server-controlled by MarketplaceController.
    const payload = {
      name: form.name?.trim(),
      description: form.description || null,
      logo_url: form.logo_url || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      city: form.city || null,
      inn: form.inn || null,
      warehouse_address: form.warehouse_address || null,
      delivery_terms: form.delivery_terms || null,
      payment_terms: form.payment_terms || null,
    };
    try {
      await marketplace.upsertSupplier(payload);
      toast.success(supplier ? "Витрина обновлена" : "Витрина создана");
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SellerLayout
      title="Витрина"
      subtitle="Публичный профиль вашей компании в маркетплейсе"
    >
      <div className="mx-auto max-w-[840px] space-y-4 p-4 sm:p-6 lg:p-8">
        {loadState === "loading" ? (
          <div className="flex items-center justify-center gap-3 py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <span>Загружаем профиль…</span>
          </div>
        ) : loadState === "error" ? (
          <ErrorState
            title="Не удалось загрузить витрину"
            description={loadError || "Проверьте интернет и попробуйте снова."}
            actionLabel="Попробовать снова"
            onAction={load}
          />
        ) : (
          <>
            {loadState === "notFound" && (
              <div className="flex items-center gap-2 rounded-[12px] border border-primary/20 bg-primary/10 px-4 py-3 text-[13px] text-primary" role="status">
                <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
                Создайте витрину, чтобы публиковать товары и получать заказы.
              </div>
            )}
            {supplier && supplier.moderation_status !== "approved" && (
              <div role={supplier.moderation_status === "rejected" ? "alert" : "status"} className={`rounded-[12px] border px-4 py-3 text-[13px] ${
                supplier.moderation_status === "rejected"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-[hsl(var(--warning-amber)/0.3)] bg-[hsl(var(--warning-amber)/0.1)] text-[hsl(var(--warning-amber))]"
              }`}>
                <div className="font-semibold">
                  {supplier.moderation_status === "rejected" ? "Витрина отклонена" : "Витрина на проверке"}
                </div>
                {supplier.moderation_reason && <div className="mt-1">Причина: {supplier.moderation_reason}</div>}
              </div>
            )}

            <Card className="p-4 sm:p-6">
              <div className="mb-4 flex min-w-0 items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-[12px] bg-primary/10 text-primary">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-[16px] font-bold font-display">
                      <span className="break-words">{form.name || "Новая витрина"}</span>
                      {supplier?.is_verified && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--success-green)/0.12)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--success-green))] ring-1 ring-[hsl(var(--success-green)/0.25)]">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Проверен
                        </span>
                      )}
                    </div>
                    {supplier && (
                      <div className="text-xs text-muted-foreground">
                        Рейтинг {Number(supplier.rating).toFixed(1)} · {supplier.reviews_count} отзывов
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <div key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`seller-${String(f.key)}`} className="mb-2 block">
                      {f.label}{f.required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
                    </Label>
                    {f.textarea ? (
                      <Textarea
                        id={`seller-${String(f.key)}`}
                        required={f.required}
                        aria-invalid={fieldErrors[f.key] ? true : undefined}
                        aria-describedby={fieldErrors[f.key] ? `seller-${String(f.key)}-error` : undefined}
                        value={(form[f.key] as string) || ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={`seller-${String(f.key)}`}
                        type={f.type || "text"}
                        required={f.required}
                        aria-invalid={fieldErrors[f.key] ? true : undefined}
                        aria-describedby={fieldErrors[f.key] ? `seller-${String(f.key)}-error` : undefined}
                        value={(form[f.key] as string) || ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                    {fieldErrors[f.key] && (
                      <p id={`seller-${String(f.key)}-error`} className="mt-1 text-xs text-destructive" role="alert">
                        {fieldErrors[f.key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex justify-stretch sm:justify-end">
                <Button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  aria-busy={saving}
                  className="min-h-11 w-full sm:w-auto"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  {supplier ? "Сохранить" : "Создать витрину"}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
