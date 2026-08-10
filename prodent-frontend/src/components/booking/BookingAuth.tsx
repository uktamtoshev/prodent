import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { analytics, getStoredUtm, getStoredReferralCode } from "@/lib/analytics";
import { formatUzPhone, isValidUzPhone, normalizeUzPhone } from "@/lib/authFlow";
import { useLanguage } from "@/contexts/LanguageContext";

// Backend RegisterRequest enforces a 6-char minimum password.
const MIN_PASSWORD_LENGTH = 6;

export function BookingAuth() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("+998");

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(`${t("auth.toastLoginError")}: ${error.message}`);
    } else {
      analytics.login("email");
      toast.success(t("auth.toastLoginSuccess"));
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t("bookingAuth.passwordTooShort"));
      return;
    }
    if (!isValidUzPhone(phone)) {
      toast.error(t("bookingAuth.invalidPhone"));
      return;
    }

    setLoading(true);

    // Stored marketing attribution — forwarded to the /auth/register endpoint,
    // which records utm_source/medium/campaign and processes referral_code.
    const utm = getStoredUtm() ?? {};
    const referralCode = getStoredReferralCode();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: normalizeUzPhone(phone),
          role: "patient",
          utm_source: utm.utm_source,
          utm_medium: utm.utm_medium,
          utm_campaign: utm.utm_campaign,
          referral_code: referralCode ?? undefined,
        },
        emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}`,
      },
    });

    if (error) {
      toast.error(`${t("bookingAuth.signUpError")}: ${error.message}`);
    } else {
      analytics.signUp("email");
      toast.success(t("bookingAuth.signUpSuccess"));
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto">
      <p className="text-slate-300 text-center mb-6">
        {t("bookingAuth.intro")}
      </p>

      <Tabs defaultValue="signin" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-700">
          <TabsTrigger value="signin">{t("auth.login")}</TabsTrigger>
          <TabsTrigger value="signup">{t("auth.register")}</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="signin-email" className="text-slate-300">{t("auth.email")}</Label>
              <Input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="signin-password" className="text-slate-300">{t("auth.password")}</Label>
              <PasswordInput
                id="signin-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                iconClassName="text-slate-400 hover:text-white"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("bookingAuth.signingIn") : t("auth.loginButton")}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <Label htmlFor="signup-name" className="text-slate-300">{t("auth.fullName")}</Label>
              <Input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder={t("bookingAuth.fullNamePlaceholder")}
              />
            </div>
            <div>
              <Label htmlFor="signup-phone" className="text-slate-300">{t("auth.phone")}</Label>
              <Input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatUzPhone(e.target.value))}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="+998 90 123 45 67"
              />
            </div>
            <div>
              <Label htmlFor="signup-email" className="text-slate-300">{t("auth.email")}</Label>
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-700 border-slate-600 text-white"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <Label htmlFor="signup-password" className="text-slate-300">{t("auth.password")}</Label>
              <PasswordInput
                id="signup-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={MIN_PASSWORD_LENGTH}
                className="bg-slate-700 border-slate-600 text-white"
                iconClassName="text-slate-400 hover:text-white"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("bookingAuth.signingUp") : t("auth.registerButton")}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
