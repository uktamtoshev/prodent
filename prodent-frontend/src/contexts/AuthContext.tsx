import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildAuthCallbackUrl } from "@/lib/authFlow";

type AuthActionError = { message?: string } | Error | unknown;
type AuthActionResult = Promise<{ error: AuthActionError | null }>;
type AuthUserWithMetadata = User & {
  user_metadata?: {
    first_name?: string;
    full_name?: string;
  };
  firstName?: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  signUp: (email: string, password: string, fullName?: string, phone?: string, role?: string) => AuthActionResult;
  signIn: (email: string, password: string) => AuthActionResult;
  signInWithGoogle: (returnTo?: string | null) => AuthActionResult;
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
        await supabase.auth.signOut();
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
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);

          // If we have a session but the cached profile doesn't yet contain
          // a real first/last name (e.g. legacy localStorage from before this
          // shim cached profiles), hydrate from /users/me and re-emit user.
          if (session?.user) {
            const hydratedUser = session.user as AuthUserWithMetadata;
            const meta = hydratedUser.user_metadata ?? {};
            const hasName = meta.first_name || meta.full_name || hydratedUser.firstName;
            if (!hasName) {
              try {
                await supabase.auth.getUser();
                const { data: { session: refreshed } } = await supabase.auth.getSession();
                if (refreshed?.user) setUser(refreshed.user);
              } catch {
                /* non-fatal */
              }
            }
          }
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
    } catch (error: AuthActionError) {
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
    } catch (error: AuthActionError) {
      return { error };
    }
  };

  const signInWithGoogle = async (returnTo?: string | null) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthCallbackUrl(window.location.origin, returnTo),
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
    } catch (error: AuthActionError) {
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
      await supabase.auth.signOut();
    } catch {
      // Ignore errors - session might already be invalid
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
