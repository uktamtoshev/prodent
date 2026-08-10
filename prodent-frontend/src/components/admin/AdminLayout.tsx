import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { canAccessAdminPanel, loading: roleLoading } = useUserRole();
  // Also wait for the auth session to hydrate. While AuthContext is still
  // loading, `user` is briefly null, which makes useUserRole report
  // loading=false (its loading is `!!user && isLoading`) — without this the
  // guard would deny a logged-in admin on a direct navigation/refresh.
  const { loading: authLoading } = useAuth();
  const loading = authLoading || roleLoading;
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && !canAccessAdminPanel) {
      toast({
        title: t('adminLayout.accessDenied'),
        description: t('adminLayout.accessDeniedDesc'),
        variant: "destructive",
      });
    }
  }, [loading, canAccessAdminPanel, toast, t]);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background text-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (!canAccessAdminPanel) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <AdminSidebar />
      <main className="min-h-screen min-w-0 pt-16 lg:pl-64 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
