import { ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { AdminSidebar } from './AdminSidebar';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { canAccessAdminPanel, loading } = useUserRole();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !canAccessAdminPanel) {
      console.log('[AdminLayout] Access denied: user does not have admin panel access');
      toast({
        title: "Доступ запрещён",
        description: "У вас нет прав для доступа к админ-панели",
        variant: "destructive",
      });
    }
  }, [loading, canAccessAdminPanel, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C6BB]" />
      </div>
    );
  }

  if (!canAccessAdminPanel) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex w-full">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};