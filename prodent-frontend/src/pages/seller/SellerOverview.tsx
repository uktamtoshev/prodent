import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  CreditCard,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Store,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { SellerLayout } from "@/components/seller/SellerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { DesignBadge, DesignCard, SectionTitle } from "@/components/design";
import {
  hasSellerDashboardActivity,
  marketplace,
  sellerDashboardToCsv,
  type SellerDailyRevenue,
  type SellerDashboard,
} from "@/lib/marketplace";

const money = (value: number, currency = "UZS") =>
  `${Math.round(value).toLocaleString("ru-RU")} ${currency === "UZS" ? "сум" : currency}`;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось загрузить данные";

function Spark({ data }: { data: SellerDailyRevenue[] }) {
  if (data.length === 0) return <div className="grid h-[100px] place-items-center text-[12px] text-slate-400">Продаж за период нет</div>;
  const max = Math.max(1, ...data.map((day) => day.revenue));
  const divisor = Math.max(1, data.length - 1);
  const points = data.map((day, index) => [(index / divisor) * 280, 76 - (day.revenue / max) * 66]);
  const path = `M${points.map((point) => point.join(",")).join(" L ")}`;
  const fill = `${path} L 280,80 L 0,80 Z`;

  return (
    <svg viewBox="0 0 280 80" className="h-[100px] w-full" preserveAspectRatio="none" aria-label="График выручки за семь дней">
      <defs>
        <linearGradient id="sellerRevenueFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.25" />
          <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sellerRevenueFill)" />
      <path d={path} fill="none" stroke="hsl(var(--brand))" strokeWidth="2" strokeLinecap="round" />
      {points.map(([x, y], index) => <circle key={data[index].date} cx={x} cy={y} r={3} fill="hsl(var(--brand))" />)}
    </svg>
  );
}

export default function SellerOverview() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SellerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await marketplace.getDashboard());
    } catch (loadError) {
      setDashboard(null);
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, user?.id]);

  const firstName =
    (user?.user_metadata?.first_name as string) ||
    (user?.user_metadata?.full_name as string)?.split(" ")[0] ||
    "";
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? "Доброй ночи" : hour < 12 ? "Доброе утро" : hour < 18 ? "Добрый день" : "Добрый вечер";
  const dateText = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const dateLabel = dateText.charAt(0).toUpperCase() + dateText.slice(1);

  const attention = useMemo(() => {
    if (!dashboard) return [];
    const rows: Array<{ title: string; subtitle: string; href: string }> = [];
    if (dashboard.out_of_stock_count > 0) {
      rows.push({
        title: `Без остатка: ${dashboard.out_of_stock_count}`,
        subtitle: "Пополните склад, чтобы товары снова были доступны",
        href: "/seller/warehouse",
      });
    }
    if (dashboard.low_stock_count > 0) {
      rows.push({
        title: `Низкий остаток: ${dashboard.low_stock_count}`,
        subtitle: "Количество ниже заданного минимума",
        href: "/seller/warehouse",
      });
    }
    const activeOrders = dashboard.status_counts.new + dashboard.status_counts.accepted + dashboard.status_counts.preparing;
    if (activeOrders > 0) {
      rows.push({
        title: `Заказы в работе: ${activeOrders}`,
        subtitle: "Проверьте новые заказы и текущую сборку",
        href: "/seller/orders",
      });
    }
    return rows;
  }, [dashboard]);

  const exportReport = () => {
    if (!dashboard) return;
    const blob = new Blob([sellerDashboardToCsv(dashboard)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `seller-overview-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV-отчёт скачан");
  };

  return (
    <SellerLayout title="Обзор" subtitle={dateLabel}>
      <div className="mx-auto max-w-[1320px] p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{dateLabel}</div>
            <h1 className="mt-1 font-display text-[26px] font-bold tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            {dashboard?.has_storefront && (
              <p className="mt-1 text-[13.5px] text-slate-500">
                Новых заказов: {dashboard.status_counts.new} · Товаров без остатка: {dashboard.out_of_stock_count}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportReport}
              disabled={!dashboard || loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white px-4 text-[14px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> Экспорт отчёта
            </button>
            <Link to="/seller/products" className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[hsl(var(--brand))] px-4 text-[14px] font-semibold text-white shadow-sm hover:brightness-110">
              <Plus className="h-4 w-4" /> Добавить товар
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-[320px] place-items-center rounded-[14px] border border-slate-200 bg-white">
            <div className="text-center text-[13px] text-slate-500"><Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-[hsl(var(--brand))]" />Загружаем показатели</div>
          </div>
        ) : error ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-8 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-rose-600" />
            <div className="font-semibold text-rose-900">Данные не загрузились</div>
            <div className="mt-1 text-[13px] text-rose-700">{error}</div>
            <button type="button" onClick={() => void loadDashboard()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-[10px] bg-white px-4 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50">
              <RefreshCw className="h-4 w-4" /> Повторить
            </button>
          </div>
        ) : dashboard && !dashboard.has_storefront ? (
          <div className="rounded-[14px] border border-slate-200 bg-white px-6 py-16 text-center">
            <Store className="mx-auto mb-4 h-10 w-10 text-[hsl(var(--brand))]" />
            <h2 className="font-display text-[18px] font-bold">Сначала создайте витрину</h2>
            <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-500">После заполнения профиля здесь появятся реальные заказы, продажи и остатки.</p>
            <Link to="/seller/profile" className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-[hsl(var(--brand))] px-4 text-[13.5px] font-semibold text-white hover:brightness-110">Создать витрину</Link>
          </div>
        ) : dashboard ? (
          <>
            {!hasSellerDashboardActivity(dashboard) && (
              <DesignCard className="mb-4 text-center" pad="p-6">
                <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <div className="font-semibold text-slate-800">Данных пока нет</div>
                <div className="mt-1 text-[13px] text-slate-500">Добавьте товары. Продажи и отзывы появятся здесь автоматически.</div>
                <Link to="/seller/products" className="mt-4 inline-flex text-[13px] font-semibold text-[hsl(var(--brand-700))]">Перейти к товарам →</Link>
              </DesignCard>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Выручка · 30 дней", value: money(dashboard.revenue_30_days, dashboard.currency), sub: `За 7 дней: ${money(dashboard.revenue_7_days, dashboard.currency)}`, Icon: CreditCard },
                { label: "Все заказы", value: dashboard.order_count.toLocaleString("ru-RU"), sub: `Завершено: ${dashboard.completed_order_count}`, Icon: Package },
                { label: "Средний заказ", value: money(dashboard.average_order, dashboard.currency), sub: `Активных товаров: ${dashboard.active_product_count}`, Icon: Activity },
                dashboard.returns_supported
                  ? { label: "Возвраты", value: dashboard.returned_order_count.toLocaleString("ru-RU"), sub: "По завершённым операциям", Icon: AlertCircle }
                  : { label: "Отменённые заказы", value: dashboard.cancelled_order_count.toLocaleString("ru-RU"), sub: "Возвраты пока не учитываются", Icon: AlertCircle },
              ].map(({ label, value, sub, Icon }) => (
                <DesignCard key={label} pad="p-4">
                  <div className="flex items-start justify-between"><div className="text-[12px] font-medium text-slate-500">{label}</div><Icon className="h-4 w-4 text-slate-400" /></div>
                  <div className="mt-2 font-display text-[22px] font-bold leading-none tabular-nums">{value}</div>
                  <div className="mt-2 text-[11.5px] font-medium text-slate-500">{sub}</div>
                </DesignCard>
              ))}
            </div>

            <div className="mb-6 grid grid-cols-12 gap-4">
              <DesignCard className="col-span-12 lg:col-span-7">
                <div className="mb-3 flex items-center justify-between">
                  <div><div className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">Выручка · 7 дней</div><div className="mt-1 font-display text-[22px] font-bold tabular-nums">{money(dashboard.revenue_7_days, dashboard.currency)}</div></div>
                  <Link to="/seller/finance" className="text-[12px] font-medium text-slate-500 hover:text-slate-800">Подробнее →</Link>
                </div>
                <Spark data={dashboard.daily_revenue_7_days} />
                <div className="mt-2 flex justify-between text-[10.5px] text-slate-400">
                  {dashboard.daily_revenue_7_days.map((day) => <span key={day.date}>{new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(new Date(`${day.date}T00:00:00`))}</span>)}
                </div>
              </DesignCard>

              <DesignCard className="col-span-12 lg:col-span-5">
                <SectionTitle subtitle="проверки по реальным данным">Требует внимания</SectionTitle>
                {attention.length === 0 ? (
                  <div className="mt-4 rounded-[10px] bg-emerald-50 p-4 text-[13px] text-emerald-800">Сейчас срочных действий нет.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {attention.map((row) => (
                      <Link key={row.title} to={row.href} className="flex items-start gap-3 rounded-[10px] border border-slate-200 bg-slate-50/40 p-3 transition hover:border-slate-300 hover:bg-white">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-amber-100 text-amber-700"><AlertCircle className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1"><div className="text-[13px] font-medium text-slate-800">{row.title}</div><div className="mt-0.5 text-[11.5px] text-slate-500">{row.subtitle}</div></div>
                        <ChevronRight className="mt-1.5 h-4 w-4 text-slate-300" />
                      </Link>
                    ))}
                  </div>
                )}
              </DesignCard>
            </div>

            <DesignCard pad="p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div><div className="font-display text-[15px] font-semibold">Топ-товары</div><div className="mt-0.5 text-[12px] text-slate-500">по завершённым заказам</div></div>
                <Link to="/seller/products" className="text-[12px] font-medium text-slate-500 hover:text-slate-800">Все товары →</Link>
              </div>
              {dashboard.top_products.length === 0 ? (
                <div className="px-5 py-10 text-center text-[13px] text-slate-500">Проданных товаров пока нет</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {dashboard.top_products.map((product, index) => (
                    <div key={product.product_id ?? `${product.name}-${index}`} className="grid grid-cols-[1fr,100px,120px] items-center gap-3 px-5 py-3 text-[13px] sm:grid-cols-[1fr,120px,100px,150px]">
                      <div className="font-medium text-slate-800">{product.name}</div>
                      <div className="hidden font-mono text-[11px] text-slate-500 sm:block">{product.sku ?? "—"}</div>
                      <div className="text-right tabular-nums">{product.units_sold} шт.</div>
                      <div className="text-right font-semibold tabular-nums">{money(product.revenue, dashboard.currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </DesignCard>

            <div className="mt-6 flex items-center gap-2 text-[12px] text-slate-500"><DesignBadge tone="emerald">PRODENT Marketplace</DesignBadge>Данные загружаются из кабинета продавца</div>
          </>
        ) : null}
      </div>
    </SellerLayout>
  );
}
