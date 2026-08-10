import { useMemo } from "react";
import {
  Activity,
  Boxes,
  CreditCard,
  Package,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { marketplace } from "@/lib/marketplace";
import {
  RoleSidebar,
  RoleSidebarNavItem,
} from "@/components/shared/RoleSidebar";
import { cn } from "@/lib/utils";

export function SellerSidebar() {
  const { t } = useLanguage();
  const { data: dashboard } = useQuery({
    queryKey: ["marketplace", "seller-dashboard"],
    queryFn: marketplace.getDashboard,
    staleTime: 30_000,
  });
  const productCount = dashboard?.active_product_count ?? 0;
  const activeOrderCount = dashboard
    ? dashboard.status_counts.new +
      dashboard.status_counts.accepted +
      dashboard.status_counts.awaiting_payment +
      dashboard.status_counts.preparing +
      dashboard.status_counts.shipped +
      dashboard.status_counts.received
    : 0;

  const items: RoleSidebarNavItem[] = useMemo(
    () => [
      { title: t("seller.overview"), path: "/seller", icon: Activity, end: true },
      { title: t("seller.products"), path: "/seller/products", icon: Package, badge: productCount },
      { title: t("seller.warehouse"), path: "/seller/warehouse", icon: Boxes },
      { title: t("seller.orders"), path: "/seller/orders", icon: ShoppingBag, badge: activeOrderCount },
      { title: t("seller.finance"), path: "/seller/finance", icon: CreditCard },
      { title: t("seller.promo"), path: "/seller/promo", icon: Zap },
      { title: t("seller.reviews"), path: "/seller/reviews", icon: Star },
      { title: t("seller.storefront"), path: "/seller/profile", icon: Shield },
      { title: t("seller.settings"), path: "/seller/settings", icon: Settings },
    ],
    [activeOrderCount, productCount, t]
  );

  const storefrontStats = (
    <div className="rounded-md border border-sidebar-border bg-sidebar-hover p-3">
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            dashboard?.has_storefront ? "bg-sidebar-active" : "bg-destructive"
          )}
          aria-hidden="true"
        />
        <div className="text-xs font-semibold text-sidebar-text">
          {dashboard?.has_storefront ? t("seller.shopActive") : t("seller.storefront")}
        </div>
      </div>
      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-xs text-sidebar-muted">{t("seller.productsCount")}</div>
        <div className="text-sm font-bold tabular-nums text-sidebar-text">{productCount}</div>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <div className="text-xs text-sidebar-muted">{t("seller.orders")}</div>
        <div className="text-sm font-bold tabular-nums text-sidebar-active">{activeOrderCount}</div>
      </div>
    </div>
  );

  return (
    <RoleSidebar
      roleLabel={t("seller.sellerBadge")}
      items={items}
      extra={storefrontStats}
    />
  );
}
