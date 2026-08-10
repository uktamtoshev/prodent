import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { analytics } from "@/lib/analytics";
import { getHomeRouteFromProfile } from "@/lib/roleHome";
import { toast } from "sonner";
import { exchangeOAuthCode, getSafeReturnTo } from "@/lib/authFlow";

/**
 * Lands here after Google OAuth completes. The backend redirects the browser
 * to `/auth/callback?exchange_code=...&return_to=...` (or `?oauth_error=...`).
 * The short-lived code is exchanged once over JSON, so tokens never enter the
 * browser URL, history, proxy logs, or referrer headers.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const exchangeCode = params.get("exchange_code");
    const error = params.get("oauth_error");
    const returnTo = getSafeReturnTo(window.location.search);
    const authFallback = returnTo
      ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
      : "/auth";

    if (error) {
      toast.error(t("auth.toastLoginError") || "Ошибка входа через Google");
      navigate(authFallback, { replace: true });
      return;
    }

    if (!exchangeCode) {
      toast.error(t("auth.toastLoginError") || "Ошибка входа через Google");
      navigate(authFallback, { replace: true });
      return;
    }

    (async () => {
      let tokens: { accessToken: string; refreshToken: string };
      try {
        tokens = await exchangeOAuthCode(exchangeCode);
      } catch (exchangeError) {
        toast.error(
          exchangeError instanceof Error
            ? exchangeError.message
            : t("auth.toastLoginError") || "Ошибка входа через Google",
        );
        navigate(authFallback, { replace: true });
        return;
      }
      const { data, error: setErr } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (setErr) {
        toast.error(setErr.message || "Auth error");
        navigate(authFallback, { replace: true });
        return;
      }
      analytics.login("google");
      toast.success(t("auth.toastLoginSuccess") || "Вход выполнен");
      navigate(returnTo || getHomeRouteFromProfile(data.session?.user), { replace: true });
    })();
  }, [navigate, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">{t("auth.loadingSession") || "Завершаем вход…"}</p>
      </div>
    </div>
  );
}
