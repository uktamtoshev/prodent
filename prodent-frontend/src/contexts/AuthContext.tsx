import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName?: string, phone?: string, role?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Check "remember me" preference - if false and no active session marker, sign out
    const checkRememberMe = async () => {
      const rememberMe = localStorage.getItem("rememberMe");
      const activeSession = sessionStorage.getItem("activeSession");
      
      // If user didn't check "remember me" and browser was closed (no activeSession)
      if (rememberMe === "false" && !activeSession) {
        await supabase.auth.signOut({ scope: 'local' });
        localStorage.removeItem("rememberMe");
        return true; // Session should be cleared
      }
      return false;
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    checkRememberMe().then((cleared) => {
      if (!cleared) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string, phone?: string, role: string = 'patient') => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone,
            role: role
          }
        }
      });

      if (error) {
        toast({
          title: "Ошибка регистрации",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Успешная регистрация",
          description: "Проверьте email для подтверждения (в режиме разработки подтверждение не требуется)",
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: "Ошибка входа",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Успешный вход",
          description: "Добро пожаловать в DentalPro!",
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        toast({
          title: "Ошибка входа через Google",
          description: error.message,
          variant: "destructive",
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    // Immediately clear state for instant UI update
    setUser(null);
    setSession(null);
    
    // Clear remember me storage
    localStorage.removeItem("rememberMe");
    sessionStorage.removeItem("activeSession");
    
    // Then sign out from Supabase (ignore errors for stale sessions)
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      // Ignore errors - session might already be invalid
      console.log('Sign out completed');
    }
    
    toast({
      title: "Выход выполнен",
      description: "До скорой встречи!",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
