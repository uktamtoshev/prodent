import { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, User, Stethoscope, Building2, ArrowRight, CheckCircle2, ArrowLeft, Eye, EyeOff, KeyRound, Wrench, Package, Users } from "lucide-react";
import { toast } from "sonner";
import { OtpInput } from "@/components/auth/OtpInput";
import { OtpTimer } from "@/components/auth/OtpTimer";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/edge-function-error";
import { getHomeRouteFromProfile } from "@/lib/roleHome";
import { analytics } from "@/lib/analytics";
import {
  formatUzPhone,
  getSafeReturnTo,
  isValidUzPhone,
  normalizeUzPhone,
} from "@/lib/authFlow";
import { BrandMark } from "@/components/shared/BrandMark";

const DoctorApplicationForm = lazy(() =>
  import("@/components/auth/DoctorApplicationForm").then((module) => ({
    default: module.DoctorApplicationForm,
  })),
);
const ClinicApplicationForm = lazy(() =>
  import("@/components/auth/ClinicApplicationForm").then((module) => ({
    default: module.ClinicApplicationForm,
  })),
);
const TechnicianApplicationForm = lazy(() =>
  import("@/components/auth/TechnicianApplicationForm").then((module) => ({
    default: module.TechnicianApplicationForm,
  })),
);
const SupplierApplicationForm = lazy(() =>
  import("@/components/auth/SupplierApplicationForm").then((module) => ({
    default: module.SupplierApplicationForm,
  })),
);

type AuthStep = "form" | "otp" | "password" | "complete";
// Registration is split into two categories: a patient, or "medical staff" who
// then pick a specific role. `supplier` (юр. лицо) maps to the marketplace SELLER
// role after admin approval.
type Role = "patient" | "doctor" | "clinic" | "technician" | "supplier";
type RegCategory = "patient" | "staff";
// Org (legal-entity) roles have no ФИО/отчество — just an organisation name.
const ORG_ROLES: Role[] = ["clinic", "supplier"];
// Staff roles register as PATIENT, then fill a verification application.
const STAFF_ROLES: Role[] = ["doctor", "clinic", "technician", "supplier"];
type VerificationMethod = "phone" | "email";

// Keep this in sync with RegistrationConsentService on the backend. A consent
// record is immutable, so the exact document versions must travel with the
// registration verify request.
const LEGAL_DOCUMENT_VERSION = "2026-07-27";

// Backend RegisterRequest / SetPasswordRequest / ResetPasswordRequest enforce
// min 6 chars — keep the frontend validation in sync so users aren't accepted
// here then rejected by the server.
const MIN_PASSWORD_LENGTH = 6;

function ApplicationFormFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function Auth() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Form state
  const [category, setCategory] = useState<RegCategory>("patient");
  const [role, setRole] = useState<Role>("patient");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState(""); // email or phone for login
  const [otpCode, setOtpCode] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("phone");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem("rememberMe");
    return saved !== "false";
  });
  
  // Application form state
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [checkingPendingApplication, setCheckingPendingApplication] = useState(true);
  // Keep the verified session available only while this registration page is
  // mounted. Auth listeners may briefly clear the shared session after OTP
  // verification; a password retry can safely restore it from this in-memory
  // copy without persisting raw tokens ourselves.
  const pendingSessionRef = useRef<{
    access_token: string;
    refresh_token: string;
  } | null>(null);
  
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getSafeReturnTo(location.search, location.state);

  const googleSignInBlock = (
    <>
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">{t("auth.or") || "или"}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 gap-2"
        onClick={() => signInWithGoogle(returnTo)}
        disabled={loading}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {t("auth.googleLogin") || "Войти через Google"}
      </Button>
    </>
  );

  useEffect(() => {
    const checkPendingApplication = async () => {
      if (!user) {
        setCheckingPendingApplication(false);
        return;
      }
      // Registration sets the session before persisting the chosen password.
      // Keep the user on this page until that second step succeeds, otherwise
      // the auth listener could redirect and hide a set-password failure.
      if (activeTab === "register" && step !== "complete" && !showApplicationForm) {
        setCheckingPendingApplication(false);
        return;
      }

      // The backend does not expose the intended role via user_metadata, so fall
      // back to the pending-role flag stored at registration time.
      const userRole = user.user_metadata?.role || localStorage.getItem("prodent_pending_role");

      if (userRole === "doctor") {
        const { data: application } = await supabase
          .from("doctor_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!application) {
          setRole("doctor");
          setShowApplicationForm(true);
          setCheckingPendingApplication(false);
          return;
        }
        // Application already submitted — clear the flag and let the user through.
        localStorage.removeItem("prodent_pending_role");
      } else if (userRole === "clinic") {
        const { data: application } = await supabase
          .from("clinic_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!application) {
          setRole("clinic");
          setShowApplicationForm(true);
          setCheckingPendingApplication(false);
          return;
        }
        localStorage.removeItem("prodent_pending_role");
      } else if (userRole === "technician") {
        const { data: application } = await supabase
          .from("technician_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!application) {
          setRole("technician");
          setShowApplicationForm(true);
          setCheckingPendingApplication(false);
          return;
        }
        localStorage.removeItem("prodent_pending_role");
      } else if (userRole === "supplier") {
        const { data: application } = await supabase
          .from("supplier_applications")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!application) {
          setRole("supplier");
          setShowApplicationForm(true);
          setCheckingPendingApplication(false);
          return;
        }
        localStorage.removeItem("prodent_pending_role");
      }

      if (!showApplicationForm) {
        navigate(activeTab === "login" && returnTo ? returnTo : getHomeRouteFromProfile(user));
      }
      setCheckingPendingApplication(false);
    };

    checkPendingApplication();
  }, [activeTab, navigate, returnTo, showApplicationForm, step, user]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatUzPhone(e.target.value));
    setErrors({});
  };

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = t("auth.errEmailOrPhone");
    }
    
    if (!password) {
      newErrors.password = t("auth.errPassword");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (role === "clinic") {
      if (!clinicName.trim() || clinicName.trim().length < 2) {
        newErrors.clinicName = t("auth.errClinicName");
      }
    } else if (role === "supplier") {
      if (!companyName.trim() || companyName.trim().length < 2) {
        newErrors.companyName = t("auth.errSupplierName");
      }
    } else {
      if (!lastName.trim() || lastName.trim().length < 2) {
        newErrors.lastName = t("auth.errLastName");
      }
      if (!firstName.trim() || firstName.trim().length < 2) {
        newErrors.firstName = t("auth.errFirstName");
      }
    }
    
    // Registration is phone-OTP only — the backend has no email OTP, so the
    // email signup path always failed. Validate phone for every role.
    if (!isValidUzPhone(phone)) {
      newErrors.phone = t("auth.errPhoneInvalid");
    }

    // Validate password (backend min 6 chars)
    if (password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = t("auth.passwordTooShort");
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.passwordMismatch");
    }

    if (!consentAccepted) {
      newErrors.consent = t("auth.acceptTermsRequired");
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};

    if (password.length < MIN_PASSWORD_LENGTH) {
      newErrors.password = t("auth.passwordTooShort");
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = t("auth.passwordMismatch");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) return;

    setLoading(true);
    try {
      // Determine if it's email or phone
      let emailToUse = loginIdentifier.trim();

      // If it looks like a phone number, normalise to +<digits>. The backend
      // matches by email OR phone, so we must pass the REAL phone — not a fake
      // "<digits>@phone.prodent.uz" address (a Supabase-era hack that never
      // matches a phone-registered user, causing "Invalid credentials").
      if (emailToUse.startsWith("+") || /^\d/.test(emailToUse)) {
        if (!isValidUzPhone(emailToUse)) {
          throw new Error(t("auth.errPhoneInvalid"));
        }
        emailToUse = normalizeUzPhone(emailToUse);
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error(t("auth.toastInvalidCredentials"));
        }
        throw error;
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", rememberMe.toString());
      if (!rememberMe) {
        sessionStorage.setItem("activeSession", "true");
      }

      const loginMethod = emailToUse.startsWith("+") ? "phone" : "email";
      analytics.login(loginMethod);

      toast.success(t("auth.toastLoginSuccess"));
      setStep("complete");
      setTimeout(() => navigate(returnTo || getHomeRouteFromProfile()), 1500);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t("auth.toastLoginError")));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!validateRegisterForm()) return;

    setLoading(true);
    try {
      const phoneDigits = normalizeUzPhone(phone);
      const isOrg = ORG_ROLES.includes(role);
      const orgName = role === "clinic" ? clinicName.trim() : companyName.trim();
      const fullNameCombined = isOrg
        ? orgName
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();

      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: {
          phone: phoneDigits,
          role: role,
          full_name: fullNameCombined,
          last_name: !isOrg ? lastName.trim() : undefined,
          first_name: !isOrg ? firstName.trim() : undefined,
          middle_name: !isOrg ? middleName.trim() : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          email: email || undefined,
          action: "register",
          // The backend uses action to issue a registration OTP (and reject an
          // already registered phone), rather than treating this as login.
          legal_consent_accepted: consentAccepted,
          terms_version: LEGAL_DOCUMENT_VERSION,
          privacy_version: LEGAL_DOCUMENT_VERSION,
          locale: document.documentElement.lang || "ru",
        },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastSendCodeError"));
      }

      setMaskedContact(data.masked_phone || data.masked_email);
      setStep("otp");
      toast.success(t("auth.toastSmsSent"));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t("auth.toastSendCodeError")));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: t("auth.err6DigitCode") });
      return;
    }

    setLoading(true);
    try {
      const phoneDigits = normalizeUzPhone(phone);
      const isOrg = ORG_ROLES.includes(role);
      const orgName = role === "clinic" ? clinicName.trim() : companyName.trim();
      const fullNameCombined = isOrg
        ? orgName
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();

      // Registration is phone-OTP only (backend has no email OTP).
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: {
          type: "phone",
          contact: phoneDigits,
          phone: phoneDigits,
          code: otpCode,
          action: "register",
          role: role,
          full_name: fullNameCombined,
          last_name: !isOrg ? lastName.trim() : undefined,
          first_name: !isOrg ? firstName.trim() : undefined,
          middle_name: !isOrg ? middleName.trim() : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          // verify-code authenticates the newly verified user; the password is
          // persisted by the authenticated set-password call below.
          legal_consent_accepted: consentAccepted,
          terms_version: LEGAL_DOCUMENT_VERSION,
          privacy_version: LEGAL_DOCUMENT_VERSION,
          locale: document.documentElement.lang || "ru",
        },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastVerifyError"));
      }

      // Remember the intended staff role before storing the session. The auth
      // guard reads this flag, but deliberately keeps the user on the password
      // step until set-password succeeds.
      const isStaffRole = STAFF_ROLES.includes(role);
      if (isStaffRole) {
        localStorage.setItem("prodent_pending_role", role);
        setRole(role);
      }

      const accessToken = data.session?.access_token ?? data.access_token;
      const refreshToken = data.session?.refresh_token ?? data.refresh_token ?? "";
      if (accessToken) {
        const verifiedSession = {
          access_token: accessToken,
          refresh_token: refreshToken,
        };
        pendingSessionRef.current = verifiedSession;
        await supabase.auth.setSession(verifiedSession);
      }

      // Persist the password chosen during registration. The OTP verify flow
      // does NOT set it (verify-code ignores the password), so without this the
      // account would have no password and the user couldn't log in afterwards.
      // set-password is authenticated and applies to the current user from the
      // JWT stored by setSession above.
      if (password) {
        const { data: setPasswordData, error: setPasswordError } =
          await supabase.functions.invoke("set-password", {
            body: { phone: phoneDigits, password },
          });
        if (
          setPasswordError ||
          setPasswordData?.success === false ||
          setPasswordData?.error
        ) {
          const message = getErrorMessage(
            setPasswordError || setPasswordData?.error,
            t("auth.toastPasswordSetError"),
          );
          setStep("password");
          setErrors({ password: message });
          toast.error(message);
          return;
        }
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", "true");
      pendingSessionRef.current = null;

      analytics.signUp("phone");

      if (isStaffRole) {
        toast.success(t("auth.toastRegisterFillForm"));
        setShowApplicationForm(true);
      } else {
        setStep("complete");
        toast.success(t("auth.toastRegisterDone"));
        setTimeout(() => navigate(getHomeRouteFromProfile()), 1500);
      }
    } catch (err: unknown) {
      setErrors({ otp: getErrorMessage(err, t("auth.toastInvalidCode")) });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!validatePasswordForm()) return;

    setLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();

      if (!session && pendingSessionRef.current) {
        const {
          data: { session: restoredSession },
          error: restoreError,
        } = await supabase.auth.setSession(pendingSessionRef.current);

        if (restoreError) {
          throw restoreError;
        }
        session = restoredSession;
      }
      
      if (!session) {
        throw new Error(t("auth.toastSessionExpired"));
      }

      const { data, error } = await supabase.functions.invoke("set-password", {
        body: { phone: "+" + phone.replace(/\D/g, ""), password },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastPasswordSetError"));
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", "true");
      pendingSessionRef.current = null;

      if (STAFF_ROLES.includes(role)) {
        toast.success(t("auth.toastPasswordSet"));
        setShowApplicationForm(true);
      } else {
        setStep("complete");
        toast.success(t("auth.toastRegisterDone"));
        setTimeout(() => navigate(getHomeRouteFromProfile()), 1500);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("auth.toastPasswordSetError"));
      setErrors({ password: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    // Password reset is phone-only — the backend reset endpoints work on phone.
    if (!isValidUzPhone(phone)) {
      setErrors({ phone: t("auth.errPhoneInvalid") });
      return;
    }
    const phoneE164 = normalizeUzPhone(phone);

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reset-code", {
        body: {
          phone: phoneE164,
        },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastSendCodeError"));
      }

      setMaskedContact(data.masked_contact || data.masked_phone);
      setStep("otp");
      toast.success(t("auth.toastResetSent"));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t("auth.toastSendCodeError")));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: t("auth.err6DigitCode") });
      return;
    }

    if (!validatePasswordForm()) return;

    setLoading(true);
    try {
      // Backend ResetPasswordRequest expects { phone, code, newPassword }.
      const phoneE164 = normalizeUzPhone(phone);

      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: {
          phone: phoneE164,
          code: otpCode,
          newPassword: password,
        },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastResetError"));
      }

      setStep("complete");
      toast.success(t("auth.toastPasswordChanged"));
      setTimeout(() => {
        setActiveTab("login");
        setStep("form");
        setPassword("");
        setConfirmPassword("");
        setOtpCode("");
      }, 2000);
    } catch (err: unknown) {
      setErrors({ otp: getErrorMessage(err, t("auth.toastError")) });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      // Both register and reset OTP flows are phone-based; backend reads `phone`.
      const phoneE164 = "+" + phone.replace(/\D/g, "");

      const { data, error } = await supabase.functions.invoke("resend-code", {
        body: {
          phone: phoneE164,
          action: activeTab === "forgot" ? "reset" : "register",
        },
      });

      if (error) {
        throw new Error(error.message || t("auth.toastServerError"));
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || t("auth.toastResendError"));
      }
      toast.success(t("auth.toastCodeResent"));
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t("auth.toastSendCodeError")));
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    if (step === "otp" || step === "password") {
      pendingSessionRef.current = null;
      setStep("form");
      setOtpCode("");
      setPassword("");
      setConfirmPassword("");
      setErrors({});
    }
  };

  const resetForm = () => {
    pendingSessionRef.current = null;
    setStep("form");
    setOtpCode("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setPhone("+998");
    setEmail("");
    setLoginIdentifier("");
    setCategory("patient");
    setRole("patient");
    setCompanyName("");
    setConsentAccepted(false);
  };

  if (checkingPendingApplication && !showApplicationForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showApplicationForm && role === "doctor") {
    return (
      <Suspense fallback={<ApplicationFormFallback />}>
        <DoctorApplicationForm />
      </Suspense>
    );
  }

  if (showApplicationForm && role === "clinic") {
    return (
      <Suspense fallback={<ApplicationFormFallback />}>
        <ClinicApplicationForm />
      </Suspense>
    );
  }

  if (showApplicationForm && role === "technician") {
    return (
      <Suspense fallback={<ApplicationFormFallback />}>
        <TechnicianApplicationForm />
      </Suspense>
    );
  }

  if (showApplicationForm && role === "supplier") {
    return (
      <Suspense fallback={<ApplicationFormFallback />}>
        <SupplierApplicationForm />
      </Suspense>
    );
  }

  // Specific roles shown once "Мед. персонал" is picked. Clinic & supplier are
  // legal entities (org name, no ФИО/отчество).
  const staffRoles = [
    { value: "doctor" as Role, label: t("auth.doctor"), icon: Stethoscope, color: "text-primary" },
    { value: "clinic" as Role, label: t("auth.clinic"), icon: Building2, color: "text-primary" },
    { value: "technician" as Role, label: t("auth.technician"), icon: Wrench, color: "text-primary" },
    { value: "supplier" as Role, label: t("auth.supplier"), icon: Package, color: "text-[hsl(var(--warning-amber))]" },
  ];

  const selectCategory = (cat: RegCategory) => {
    setCategory(cat);
    setVerificationMethod("phone");
    setErrors({});
    // Patient is a single role; staff defaults to the first staff role unless one
    // is already selected.
    if (cat === "patient") setRole("patient");
    else if (!STAFF_ROLES.includes(role)) setRole("doctor");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-sm border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <BrandMark size="md" className="mx-auto mb-3" />
            {step === "otp" ? (
              <>
                <h1 className="text-xl font-bold">{t("auth.otpTitle")}</h1>
                <p className="text-sm text-muted-foreground">{t("auth.otpSentTo")} {maskedContact}</p>
              </>
            ) : step === "password" && activeTab === "forgot" ? (
              <>
                <h1 className="text-xl font-bold">{t("auth.newPasswordTitle")}</h1>
                <p className="text-sm text-muted-foreground">{t("auth.newPasswordSubtitle")}</p>
              </>
            ) : step === "complete" ? (
              <>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success-emerald))]">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-xl font-bold">{t("auth.doneTitle")}</h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "forgot" ? t("auth.passwordChangedSubtitle") : t("auth.redirecting")}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold">
                  {activeTab === "login" && t("auth.login")}
                  {activeTab === "register" && t("auth.register")}
                  {activeTab === "forgot" && t("auth.forgotTitle")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "login" && t("auth.loginSubtitle")}
                  {activeTab === "register" && t("auth.registerSubtitle")}
                  {activeTab === "forgot" && t("auth.forgotSubtitle")}
                </p>
              </>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            {step === "form" && (
              <>
                <Tabs
                  value={activeTab}
                  onValueChange={(value) => {
                    if (value === "login" || value === "register") {
                      setActiveTab(value);
                      resetForm();
                    }
                  }}
                >
                  <TabsList className="mb-4 grid h-14 w-full grid-cols-2" aria-label={t("auth.accountType")}>
                    <TabsTrigger
                      value="login"
                      data-testid="auth-login-tab"
                      className="min-h-11 min-w-0 w-full px-2 text-xs sm:px-4 sm:text-sm"
                    >
                      {t("auth.login")}
                    </TabsTrigger>
                    <TabsTrigger
                      value="register"
                      data-testid="auth-register-tab"
                      className="min-h-11 min-w-0 w-full px-2 text-xs sm:px-4 sm:text-sm"
                    >
                      {t("auth.register")}
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* LOGIN TAB */}
                  <TabsContent value="login" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="login-identifier">{t("auth.emailOrPhone")}</Label>
                      <Input
                        id="login-identifier"
                        data-testid="auth-login-identifier"
                        type="text"
                        placeholder={t("auth.emailOrPhonePlaceholder")}
                        value={loginIdentifier}
                        onChange={(e) => { setLoginIdentifier(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.loginIdentifier && "border-destructive")}
                        aria-invalid={Boolean(errors.loginIdentifier)}
                        aria-describedby={errors.loginIdentifier ? "login-identifier-error" : undefined}
                      />
                      {errors.loginIdentifier && (
                        <p id="login-identifier-error" className="text-xs text-destructive" role="alert">
                          {errors.loginIdentifier}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t("auth.password")}</Label>
                      <div className="relative">
                      <Input
                          id="login-password"
                          data-testid="auth-login-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "login-password-error" : undefined}
                        />
                        <button
                          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                          aria-controls="login-password"
                          aria-pressed={showPassword}
                          data-testid="auth-login-password-reveal"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="login-password-error" className="text-xs text-destructive" role="alert">
                          {errors.password}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="rememberMe"
                        data-testid="auth-remember-target"
                        className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring"
                      >
                        <Checkbox 
                          id="rememberMe" 
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                          aria-label={t("auth.rememberMe")}
                          className="h-5 w-5"
                        />
                        <span>
                          {t("auth.rememberMe")}
                        </span>
                      </label>
                      <button
                        type="button"
                        data-testid="auth-forgot-password"
                        onClick={() => setActiveTab("forgot")}
                        className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-primary hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("auth.forgotPassword")}
                      </button>
                    </div>
                    
                    <Button
                      className="w-full h-11"
                      onClick={handleLogin}
                      disabled={loading}
                      data-testid="auth-login-submit"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>{t("auth.loginButton")} <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>

                    {googleSignInBlock}
                  </TabsContent>
                  
                  {/* REGISTER TAB */}
                  <TabsContent value="register" className="space-y-4 mt-0">
                    {/* Category selector: Patient vs Medical staff */}
                    <div className="space-y-2">
                      <Label id="registration-role-label">{t("auth.whoYouAre")}</Label>
                      <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="registration-role-label">
                        <button
                          type="button"
                          data-testid="auth-category-patient"
                          aria-pressed={category === "patient"}
                          onClick={() => selectCategory("patient")}
                          className={cn(
                            "min-h-11 rounded-lg border-2 p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            category === "patient"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <User className="mx-auto mb-1 h-5 w-5 text-primary" />
                          <span className="text-xs font-medium">{t("auth.patient")}</span>
                        </button>
                        <button
                          type="button"
                          data-testid="auth-category-staff"
                          aria-pressed={category === "staff"}
                          onClick={() => selectCategory("staff")}
                          className={cn(
                            "min-h-11 rounded-lg border-2 p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            category === "staff"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                          <span className="text-xs font-medium">{t("auth.medStaff")}</span>
                        </button>
                      </div>

                      {/* Specific staff role, only after "Мед. персонал" is chosen */}
                      {category === "staff" && (
                        <div className="grid grid-cols-2 gap-2 pt-1" role="group" aria-label={t("auth.medStaff")}>
                          {staffRoles.map((r) => {
                            const Icon = r.icon;
                            return (
                              <button
                                key={r.value}
                                type="button"
                                data-testid={`auth-role-${r.value}`}
                                aria-pressed={role === r.value}
                                onClick={() => { setRole(r.value); setErrors({}); }}
                                className={cn(
                                  "min-h-11 rounded-lg border-2 p-3 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  role === r.value
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                )}
                              >
                                <Icon className={cn("w-5 h-5 mx-auto mb-1", r.color)} />
                                <span className="text-xs font-medium">{r.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {role === "clinic" ? (
                      <div className="space-y-2">
                        <Label>{t("auth.clinicNameLabel")}</Label>
                        <Input
                          data-testid="auth-register-org-name"
                          placeholder={t("auth.clinicNamePlaceholder")}
                          value={clinicName}
                          onChange={(e) => { setClinicName(e.target.value); setErrors({}); }}
                          className={cn("h-11", errors.clinicName && "border-destructive")}
                        />
                        {errors.clinicName && <p className="text-xs text-destructive">{errors.clinicName}</p>}
                      </div>
                    ) : role === "supplier" ? (
                      <div className="space-y-2">
                        <Label>{t("auth.supplierNameLabel")}</Label>
                        <Input
                          data-testid="auth-register-org-name"
                          placeholder={t("auth.supplierNamePlaceholder")}
                          value={companyName}
                          onChange={(e) => { setCompanyName(e.target.value); setErrors({}); }}
                          className={cn("h-11", errors.companyName && "border-destructive")}
                        />
                        {errors.companyName && <p className="text-xs text-destructive">{errors.companyName}</p>}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="register-last-name">{t("auth.lastNameLabel")}</Label>
                            <Input
                              id="register-last-name"
                              data-testid="auth-register-last-name"
                              placeholder={t("auth.lastNamePlaceholder")}
                              value={lastName}
                              onChange={(e) => { setLastName(e.target.value); setErrors({}); }}
                              className={cn("h-11", errors.lastName && "border-destructive")}
                              aria-invalid={Boolean(errors.lastName)}
                              aria-describedby={errors.lastName || errors.firstName ? "register-name-error" : undefined}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="register-first-name">{t("auth.firstNameLabel")}</Label>
                            <Input
                              id="register-first-name"
                              data-testid="auth-register-first-name"
                              placeholder={t("auth.firstNamePlaceholder")}
                              value={firstName}
                              onChange={(e) => { setFirstName(e.target.value); setErrors({}); }}
                              className={cn("h-11", errors.firstName && "border-destructive")}
                              aria-invalid={Boolean(errors.firstName)}
                              aria-describedby={errors.lastName || errors.firstName ? "register-name-error" : undefined}
                            />
                          </div>
                        </div>
                        {(errors.lastName || errors.firstName) && (
                          <p id="register-name-error" className="text-xs text-destructive" role="alert">
                            {errors.lastName || errors.firstName}
                          </p>
                        )}

                        {/* Отчество — optional, only for person roles (patient/doctor/technician) */}
                        <div className="space-y-2">
                          <Label>
                            {t("auth.middleName")}{" "}
                            <span className="text-xs font-normal text-muted-foreground">
                              {t("auth.middleNameOptional")}
                            </span>
                          </Label>
                          <Input
                            data-testid="auth-register-middle-name"
                            placeholder={t("auth.middleNamePh")}
                            value={middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </>
                    )}
                    
                    {/* Phone input — registration is verified by SMS OTP only
                        (the backend has no email OTP). */}
                    <div className="space-y-2">
                      <Label htmlFor="register-phone">{t("auth.phoneNumberLabel")}</Label>
                      <Input
                        id="register-phone"
                        data-testid="auth-register-phone"
                        type="tel"
                        placeholder="+998 XX XXX XX XX"
                        value={phone}
                        onChange={handlePhoneChange}
                        className={cn("h-11", errors.phone && "border-destructive")}
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? "register-phone-error" : undefined}
                      />
                      {errors.phone && (
                        <p id="register-phone-error" className="text-xs text-destructive" role="alert">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    {/* Password fields */}
                    <div className="space-y-2">
                      <Label htmlFor="register-password">{t("auth.passwordLabel")}</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          data-testid="auth-register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("auth.passwordPlaceholder")}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "register-password-error" : undefined}
                        />
                        <button
                          type="button"
                          data-testid="auth-register-password-reveal"
                          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                          aria-controls="register-password"
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="register-password-error" className="text-xs text-destructive" role="alert">
                          {errors.password}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-confirm-password">{t("auth.confirmPasswordLabel")}</Label>
                      <Input
                        id="register-confirm-password"
                        data-testid="auth-register-confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("auth.confirmPasswordPlaceholder")}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.confirmPassword && "border-destructive")}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? "register-confirm-password-error" : undefined}
                      />
                      {errors.confirmPassword && (
                        <p id="register-confirm-password-error" className="text-xs text-destructive" role="alert">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>

                    <label
                      htmlFor="register-legal-consent"
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm leading-relaxed",
                        errors.consent ? "border-destructive" : "border-border",
                      )}
                    >
                      <Checkbox
                        id="register-legal-consent"
                        data-testid="auth-register-legal-consent"
                        checked={consentAccepted}
                        onCheckedChange={(checked) => {
                          setConsentAccepted(checked === true);
                          if (checked === true) {
                            setErrors((previous) => {
                              const next = { ...previous };
                              delete next.consent;
                              return next;
                            });
                          }
                        }}
                        aria-invalid={Boolean(errors.consent)}
                        aria-describedby={errors.consent ? "register-consent-error" : undefined}
                        className="mt-0.5 h-5 w-5 shrink-0"
                      />
                      <span className="text-muted-foreground">
                        {t("auth.iAccept")} {" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t("auth.termsLink")}
                        </a>{" "}{t("auth.andLink")} {" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {t("auth.privacyLink")}
                        </a>{", "}{t("auth.personalDataConsent")}
                      </span>
                    </label>
                    {errors.consent && (
                      <p id="register-consent-error" className="text-xs text-destructive" role="alert">
                        {errors.consent}
                      </p>
                    )}
                    
                    <Button
                      className="w-full h-11"
                      onClick={handleSendOtp}
                      disabled={loading}
                      data-testid="auth-register-submit"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>{t("auth.getCode")} <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>

                    {role === "patient" && googleSignInBlock}

                    {role !== "patient" && (
                      <p className="text-xs text-muted-foreground text-center">
                        {t("auth.doctorVerificationNote")}
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
                
                {/* FORGOT PASSWORD */}
                {activeTab === "forgot" && (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => { setActiveTab("login"); resetForm(); }}
                      className="flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t("auth.backToLogin")}
                    </button>
                    
                    {/* Password recovery is by SMS only — the backend reset
                        endpoints verify a phone OTP. */}
                    <div className="space-y-2">
                      <Label htmlFor="forgot-phone">{t("auth.phoneNumberRecovery")}</Label>
                      <Input
                        id="forgot-phone"
                        data-testid="auth-forgot-phone"
                        type="tel"
                        placeholder="+998 XX XXX XX XX"
                        value={phone}
                        onChange={handlePhoneChange}
                        className={cn("h-11", errors.phone && "border-destructive")}
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? "forgot-phone-error" : undefined}
                      />
                      {errors.phone && (
                        <p id="forgot-phone-error" className="text-xs text-destructive" role="alert">
                          {errors.phone}
                        </p>
                      )}
                    </div>

                    <Button
                      className="w-full h-11"
                      data-testid="auth-forgot-submit"
                      onClick={handleForgotPassword}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>{t("auth.getCode")} <KeyRound className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
            
            {/* OTP STEP */}
            {step === "otp" && (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="mb-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("auth.changeContact")}
                </button>
                
                <OtpInput
                  value={otpCode}
                  onChange={(val) => { setOtpCode(val); setErrors({}); }}
                  error={errors.otp}
                  disabled={loading}
                />
                
                {activeTab === "forgot" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="forgot-new-password">{t("auth.newPasswordTitle")}</Label>
                      <div className="relative">
                        <Input
                          id="forgot-new-password"
                          data-testid="auth-forgot-new-password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "forgot-password-error" : undefined}
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                          aria-controls="forgot-new-password"
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="forgot-password-error" className="text-xs text-destructive" role="alert">
                          {errors.password}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="forgot-confirm-password">{t("auth.confirmPassword")}</Label>
                      <Input
                        id="forgot-confirm-password"
                        data-testid="auth-forgot-confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.confirmPassword && "border-destructive")}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? "forgot-confirm-password-error" : undefined}
                      />
                      {errors.confirmPassword && (
                        <p id="forgot-confirm-password-error" className="text-xs text-destructive" role="alert">
                          {errors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </>
                )}
                
                <Button
                  className="w-full h-11"
                  data-testid="auth-otp-submit"
                  onClick={activeTab === "forgot" ? handleResetPassword : handleVerifyCode}
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    activeTab === "forgot" ? t("auth.changePasswordTitle") : t("common.confirm")
                  )}
                </Button>
                
                <OtpTimer
                  initialSeconds={60}
                  onResend={handleResendCode}
                  isResending={resending}
                />
              </>
            )}
            
            {/* PASSWORD STEP (after OTP for registration) */}
            {step === "password" && activeTab === "register" && (
              <>
                <button
                  type="button"
                  onClick={handleBack}
                  className="mb-2 flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("common.back")}
                </button>
                
                <div className="space-y-2">
                  <Label htmlFor="registration-set-password">{t("auth.password")}</Label>
                  <div className="relative">
                    <Input
                      id="registration-set-password"
                      data-testid="auth-set-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t("auth.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                      className={cn("h-11 pr-10", errors.password && "border-destructive")}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? "set-password-error" : undefined}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                      aria-controls="registration-set-password"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p id="set-password-error" className="text-xs text-destructive" role="alert">
                      {errors.password}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="registration-set-confirm-password">{t("auth.confirmPassword")}</Label>
                  <Input
                    id="registration-set-confirm-password"
                    data-testid="auth-set-confirm-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                    className={cn("h-11", errors.confirmPassword && "border-destructive")}
                    aria-invalid={Boolean(errors.confirmPassword)}
                    aria-describedby={errors.confirmPassword ? "set-confirm-password-error" : undefined}
                  />
                  {errors.confirmPassword && (
                    <p id="set-confirm-password-error" className="text-xs text-destructive" role="alert">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
                
                <Button 
                  className="w-full h-11" 
                  onClick={handleSetPassword}
                  disabled={loading}
                  data-testid="auth-set-password-submit"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>{t("auth.createAccountAction")} <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </>
            )}
            
            {step === "complete" && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
