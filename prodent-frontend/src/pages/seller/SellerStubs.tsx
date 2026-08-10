import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Save,
  Settings2,
  ShoppingBag,
  Star,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { DesignCard } from "@/components/design";
import {
  marketplace,
  type MarketplaceOrder,
  type MarketplaceOrderStatus,
  type MarketplaceReview,
  type MarketplaceSupplier,
  type SupplierUpdateInput,
} from "@/lib/marketplace";

const money = (value: number, currency = "UZS") =>
  `${Math.round(value).toLocaleString("ru-RU")} ${currency === "UZS" ? "сум" : currency}`;

const errorMessage = (error: unknown, fallback = "Не удалось загрузить данные") =>
  error instanceof Error ? error.message : fallback;

const STATUS_LABEL: Record<MarketplaceOrderStatus, string> = {
  new: "Новый",
  accepted: "Принят",
  awaiting_payment: "Ожидает оплаты",
  preparing: "Собирается",
  shipped: "Отправлен",
  received: "Получен",
  completed: "Завершён",
  cancelled: "Отменён",
};

function PageState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return <div className="grid min-h-[260px] place-items-center rounded-[14px] border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-[hsl(var(--brand))]" /></div>;
  }
  if (error) {
    return (
      <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-600" />
        <div className="font-semibold text-rose-900">Данные не загрузились</div>
        <div className="mt-1 text-[13px] text-rose-700">{error}</div>
        <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200"><RefreshCw className="h-4 w-4" /> Повторить</button>
      </div>
    );
  }
  return null;
}

export function SellerFinance() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await marketplace.listOrders("supplier"));
    } catch (loadError) {
      setOrders([]);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const completed = useMemo(
    () => orders.filter((order) => order.status === "completed" && order.payment_status === "paid"),
    [orders],
  );
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const refunded = orders.reduce(
    (sum, order) => sum + (order.refunds || [])
      .filter((refund) => refund.status === "completed")
      .reduce((refundSum, refund) => refundSum + Number(refund.amount || 0), 0),
    0,
  );
  const grossRevenue = completed.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const totalRevenue = Math.max(0, grossRevenue - refunded);
  const revenue30 = completed.filter((order) => new Date(order.created_at).getTime() >= thirtyDaysAgo).reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const averageOrder = completed.length > 0 ? totalRevenue / completed.length : 0;

  return (
    <SellerLayout title="Финансы" subtitle="Выручка по реальным заказам">
      <div className="mx-auto max-w-[1320px] space-y-4 p-6 lg:p-8">
        <PageState loading={loading} error={error} onRetry={() => void load()} />
        {!loading && !error && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Выручка за всё время", value: money(totalRevenue), Icon: Banknote },
                { label: "Выручка за 30 дней", value: money(revenue30), Icon: Clock3 },
                { label: "Средний оплаченный заказ", value: money(averageOrder), Icon: ShoppingBag },
                { label: "Возвращено покупателям", value: money(refunded), Icon: RefreshCw },
              ].map(({ label, value, Icon }) => (
                <DesignCard key={label} pad="p-4">
                  <div className="flex items-start justify-between"><div className="text-[12px] text-slate-500">{label}</div><Icon className="h-4 w-4 text-slate-400" /></div>
                  <div className="mt-2 font-display text-[21px] font-bold tabular-nums">{value}</div>
                </DesignCard>
              ))}
            </div>

            <DesignCard pad="p-0">
              <div className="border-b border-slate-100 px-5 py-4"><div className="font-display text-[15px] font-semibold">Операции по заказам</div><div className="mt-0.5 text-[12px] text-slate-500">Суммы берутся из кабинета продавца</div></div>
              {orders.length === 0 ? (
                <div className="px-5 py-12 text-center text-[13px] text-slate-500"><Package className="mx-auto mb-3 h-8 w-8 text-slate-300" />Заказов пока нет</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <Link key={order.id} to="/seller/orders" className="grid grid-cols-[1fr,120px] items-center gap-3 px-5 py-3 text-[13px] hover:bg-slate-50 sm:grid-cols-[120px,1fr,150px,150px]">
                      <div className="font-mono text-[12px] font-semibold">№ {order.order_number}</div>
                      <div className="text-slate-500">{new Date(order.created_at).toLocaleDateString("ru-RU")}</div>
                      <div className="hidden text-slate-600 sm:block">{STATUS_LABEL[order.status]}</div>
                      <div className="text-right font-semibold tabular-nums">{money(order.total_amount, order.currency)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </DesignCard>
          </>
        )}
      </div>
    </SellerLayout>
  );
}

export function SellerReviews() {
  const [supplier, setSupplier] = useState<MarketplaceSupplier | null>(null);
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentSupplier = await marketplace.getMySupplier();
      setSupplier(currentSupplier);
      if (!currentSupplier) {
        setReviews([]);
        return;
      }
      const response = await marketplace.getSupplierReviews(currentSupplier.id);
      setReviews(response.reviews);
    } catch (loadError) {
      setReviews([]);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SellerLayout title="Отзывы" subtitle="Мнения покупателей о вашей витрине">
      <div className="mx-auto max-w-[1000px] space-y-4 p-6 lg:p-8">
        <PageState loading={loading} error={error} onRetry={() => void load()} />
        {!loading && !error && !supplier && (
          <DesignCard className="py-14 text-center"><Store className="mx-auto mb-3 h-9 w-9 text-slate-400" /><div className="font-semibold">Сначала создайте витрину</div><Link to="/seller/profile" className="mt-4 inline-flex text-[13px] font-semibold text-[hsl(var(--brand-700))]">Перейти к витрине →</Link></DesignCard>
        )}
        {!loading && !error && supplier && (
          <>
            <DesignCard>
              <div className="flex flex-wrap items-center gap-5">
                <div className="font-display text-[34px] font-bold tabular-nums">{Number(supplier.rating || 0).toFixed(1)}</div>
                <div><div className="flex gap-1" aria-label={`Рейтинг ${Number(supplier.rating || 0).toFixed(1)} из 5`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-5 w-5 ${star <= Math.round(Number(supplier.rating || 0)) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div><div className="mt-1 text-[12px] text-slate-500">Отзывов: {reviews.length}</div></div>
              </div>
            </DesignCard>
            {reviews.length === 0 ? (
              <DesignCard className="py-14 text-center"><Star className="mx-auto mb-3 h-9 w-9 text-slate-300" /><div className="font-semibold">Отзывов пока нет</div><div className="mt-1 text-[13px] text-slate-500">После заказа покупатели смогут поделиться мнением.</div></DesignCard>
            ) : reviews.map((review) => (
              <DesignCard key={review.id}>
                <div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-800">{review.buyer_name || "Покупатель"}</div><div className="mt-1 flex gap-0.5">{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={`h-4 w-4 ${star <= review.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}</div></div><div className="text-[11.5px] text-slate-400">{new Date(review.created_at).toLocaleDateString("ru-RU")}</div></div>
                <div className="mt-3 whitespace-pre-wrap text-[13.5px] leading-6 text-slate-600">{review.comment?.trim() || "Покупатель оставил оценку без комментария."}</div>
              </DesignCard>
            ))}
          </>
        )}
      </div>
    </SellerLayout>
  );
}

type SettingsForm = {
  name: string;
  phone: string;
  email: string;
  website: string;
  warehouse_address: string;
  delivery_terms: string;
  payment_terms: string;
};

const emptySettings: SettingsForm = {
  name: "",
  phone: "",
  email: "",
  website: "",
  warehouse_address: "",
  delivery_terms: "",
  payment_terms: "",
};

export function SellerSettings() {
  const [form, setForm] = useState<SettingsForm>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supplier = await marketplace.getMySupplier();
      setForm(supplier ? {
        name: supplier.name || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        website: supplier.website || "",
        warehouse_address: supplier.warehouse_address || "",
        delivery_terms: supplier.delivery_terms || "",
        payment_terms: supplier.payment_terms || "",
      } : emptySettings);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Введите название компании");
      return;
    }
    setSaving(true);
    try {
      const payload: SupplierUpdateInput = {
        name,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        warehouse_address: form.warehouse_address.trim() || null,
        delivery_terms: form.delivery_terms.trim() || null,
        payment_terms: form.payment_terms.trim() || null,
      };
      const supplier = await marketplace.upsertSupplier(payload);
      setForm((current) => ({ ...current, name: supplier.name, phone: supplier.phone || "", email: supplier.email || "", website: supplier.website || "", warehouse_address: supplier.warehouse_address || "", delivery_terms: supplier.delivery_terms || "", payment_terms: supplier.payment_terms || "" }));
      toast.success("Настройки сохранены");
    } catch (saveError) {
      toast.error(errorMessage(saveError, "Не удалось сохранить настройки"));
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: keyof SettingsForm; label: string; placeholder: string; multiline?: boolean; type?: string }> = [
    { key: "name", label: "Название компании", placeholder: "Название" },
    { key: "phone", label: "Телефон", placeholder: "+998 …", type: "tel" },
    { key: "email", label: "Электронная почта", placeholder: "sales@company.uz", type: "email" },
    { key: "website", label: "Сайт", placeholder: "https://company.uz", type: "url" },
    { key: "warehouse_address", label: "Адрес склада", placeholder: "Город, улица, дом" },
    { key: "delivery_terms", label: "Условия доставки", placeholder: "Сроки, города и стоимость", multiline: true },
    { key: "payment_terms", label: "Условия оплаты", placeholder: "Доступные способы и сроки", multiline: true },
  ];

  return (
    <SellerLayout title="Настройки" subtitle="Контакты, склад, доставка и оплата">
      <div className="mx-auto max-w-[900px] p-6 lg:p-8">
        <PageState loading={loading} error={error} onRetry={() => void load()} />
        {!loading && !error && (
          <DesignCard>
            <div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--brand-50))] text-[hsl(var(--brand-700))]"><Settings2 className="h-5 w-5" /></div><div><div className="font-display font-semibold">Рабочие данные продавца</div><div className="text-[12px] text-slate-500">Эти данные сохраняются в вашей витрине.</div></div></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className={field.multiline ? "sm:col-span-2" : ""}>
                  <span className="mb-1.5 block text-[12.5px] font-medium text-slate-600">{field.label}</span>
                  {field.multiline ? (
                    <textarea value={form[field.key]} onChange={(event) => setField(field.key, event.target.value)} rows={3} placeholder={field.placeholder} className="w-full resize-y rounded-[10px] border border-slate-200 px-3 py-2 text-[13.5px] outline-none focus:border-[hsl(var(--brand))]" />
                  ) : (
                    <input type={field.type || "text"} value={form[field.key]} onChange={(event) => setField(field.key, event.target.value)} placeholder={field.placeholder} className="h-10 w-full rounded-[10px] border border-slate-200 px-3 text-[13.5px] outline-none focus:border-[hsl(var(--brand))]" />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[hsl(var(--brand))] px-4 text-[13.5px] font-semibold text-white hover:brightness-110 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Сохранить</button></div>
          </DesignCard>
        )}
      </div>
    </SellerLayout>
  );
}

export function SellerPromo() {
  const [supplier, setSupplier] = useState<MarketplaceSupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSupplier(await marketplace.getMySupplier());
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const checks: Array<{ label: string; ready: boolean; Icon: ComponentType<{ className?: string }> }> = supplier ? [
    { label: "Витрина активна", ready: supplier.is_active, Icon: Store },
    { label: "Контакты заполнены", ready: Boolean(supplier.phone || supplier.email), Icon: CheckCircle2 },
    { label: "Условия доставки заполнены", ready: Boolean(supplier.delivery_terms), Icon: Package },
    { label: "Витрина подтверждена", ready: supplier.is_verified, Icon: BadgeCheck },
  ] : [];

  return (
    <SellerLayout title="Продвижение" subtitle="Готовность витрины и ссылки для покупателей">
      <div className="mx-auto max-w-[1000px] space-y-4 p-6 lg:p-8">
        <PageState loading={loading} error={error} onRetry={() => void load()} />
        {!loading && !error && !supplier && (
          <DesignCard className="py-14 text-center"><Store className="mx-auto mb-3 h-9 w-9 text-slate-400" /><div className="font-semibold">Сначала создайте витрину</div><div className="mx-auto mt-1 max-w-md text-[13px] text-slate-500">Продвигать можно только товары действующей витрины.</div><Link to="/seller/profile" className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-[hsl(var(--brand))] px-4 text-[13px] font-semibold text-white">Создать витрину</Link></DesignCard>
        )}
        {!loading && !error && supplier && (
          <>
            <DesignCard>
              <div className="font-display text-[18px] font-bold">{supplier.is_active ? "Витрина готова принимать покупателей" : "Витрина сейчас неактивна"}</div>
              <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-slate-600">
                Заполните карточки и условия доставки, затем делитесь проверенной публичной витриной. Покупатель увидит только одобренные товары.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/seller/products" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[hsl(var(--brand))] px-4 text-[13px] font-semibold text-white">
                  <ShoppingBag className="h-4 w-4" /> Управлять товарами
                </Link>
                <Link to={`/market/supplier/${supplier.id}`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700">
                  <ExternalLink className="h-4 w-4" /> Посмотреть витрину
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${window.location.origin}/market/supplier/${supplier.id}`);
                    toast.success("Ссылка на витрину скопирована");
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700"
                >
                  <Copy className="h-4 w-4" /> Скопировать ссылку
                </button>
              </div>
            </DesignCard>
            <div className="grid gap-3 sm:grid-cols-2">
              {checks.map(({ label, ready, Icon }) => (
                <DesignCard key={label} pad="p-4"><div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-[9px] ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><Icon className="h-4 w-4" /></div><div><div className="text-[13px] font-semibold text-slate-800">{label}</div><div className={`text-[11.5px] ${ready ? "text-emerald-700" : "text-amber-700"}`}>{ready ? "Готово" : "Нужно заполнить"}</div></div></div></DesignCard>
              ))}
            </div>
          </>
        )}
      </div>
    </SellerLayout>
  );
}
