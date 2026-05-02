import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { DoctorSidebar } from './DoctorSidebar';

interface DoctorLayoutProps {
  children: ReactNode;
}

export const DoctorLayout = ({ children }: DoctorLayoutProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      // Check user_roles table
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const hasRoleAccess = roles?.some(r => r.role === 'doctor' || r.role === 'super_admin');

      if (hasRoleAccess) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check clinic_members table
      const { data: membership } = await supabase
        .from('clinic_members')
        .select('role')
        .eq('user_id', user.id);

      const hasMemberAccess = membership?.some(m => m.role === 'doctor');

      if (!hasMemberAccess) {
        toast({
          title: 'Доступ запрещён',
          description: 'Только для врачей',
          variant: 'destructive',
        });
      }

      setHasAccess(!!hasMemberAccess);
    } catch (error) {
      console.error('Error checking access:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !hasAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <DoctorSidebar />
      <main className="flex-1 lg:pl-72 min-h-screen">
        {children}
      </main>
    </div>
  );
};
