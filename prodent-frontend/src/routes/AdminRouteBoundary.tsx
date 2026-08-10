import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
  adminHomeForRole,
  canAccessAdminPath,
  isPlatformAdminRole,
} from "@/lib/admin-access-policy";

export function AdminRouteBoundary({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (authLoading || (user && roleLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Проверяем доступ</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/auth"
        replace
        state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }}
      />
    );
  }

  if (!isPlatformAdminRole(role)) return <Navigate to="/" replace />;
  if (!canAccessAdminPath(role, location.pathname)) {
    return <Navigate to={adminHomeForRole(role)} replace />;
  }

  return children ?? <Outlet />;
}
