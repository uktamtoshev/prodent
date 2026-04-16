import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Loader2, User, Stethoscope, Building2, Phone, Mail, ArrowRight, CheckCircle2, ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { DoctorApplicationForm } from "@/components/auth/DoctorApplicationForm";
import { ClinicApplicationForm } from "@/components/auth/ClinicApplicationForm";
import { OtpInput } from "@/components/auth/OtpInput";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/edge-function-error";
import prodentLogo from "@/assets/prodent-logo.png";

type AuthStep = "form" | "otp" | "password" | "complete";
type Role = "patient" | "doctor" | "clinic";
type VerificationMethod = "phone" | "email";

export default function Auth() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  const [step, setStep] = useState<AuthStep>("form");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Form state
  const [role, setRole] = useState<Role>("patient");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState(""); // email or phone for login
  const [otpCode, setOtpCode] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("phone");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(() => {
    const saved = localStorage.getItem("rememberMe");
    return saved !== "false";
  });
  
  // Application form state
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [checkingPendingApplication, setCheckingPendingApplication] = useState(true);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkPendingApplication = async () => {
      if (!user) {
        setCheckingPendingApplication(false);
        return;
      }

      const userRole = user.user_metadata?.role;
      
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
      }

      if (!showApplicationForm) {
        navigate("/");
      }
      setCheckingPendingApplication(false);
    };

    checkPendingApplication();
  }, [user, navigate, showApplicationForm]);

  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, "");
    if (!digits.startsWith("998")) {
      digits = "998" + digits;
    }
    digits = digits.slice(0, 12);
    
    let formatted = "+998";
    if (digits.length > 3) formatted += " " + digits.slice(3, 5);
    if (digits.length > 5) formatted += " " + digits.slice(5, 8);
    if (digits.length > 8) formatted += " " + digits.slice(8, 10);
    if (digits.length > 10) formatted += " " + digits.slice(10, 12);
    
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
    setErrors({});
  };

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!loginIdentifier.trim()) {
      newErrors.loginIdentifier = "Введите email или номер телефона";
    }
    
    if (!password) {
      newErrors.password = "Введите пароль";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateRegisterForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (role === "clinic") {
      if (!clinicName.trim() || clinicName.trim().length < 2) {
        newErrors.clinicName = "Введите название клиники (минимум 2 символа)";
      }
    } else {
      if (!lastName.trim() || lastName.trim().length < 2) {
        newErrors.lastName = "Введите фамилию (минимум 2 символа)";
      }
      if (!firstName.trim() || firstName.trim().length < 2) {
        newErrors.firstName = "Введите имя (минимум 2 символа)";
      }
    }
    
    // For doctors and clinics - only phone
    if (role !== "patient") {
      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length !== 12) {
        newErrors.phone = "Введите корректный номер телефона";
      }
    } else {
      // For patients - phone or email based on selection
      if (verificationMethod === "phone") {
        const phoneDigits = phone.replace(/\D/g, "");
        if (phoneDigits.length !== 12) {
          newErrors.phone = "Введите корректный номер телефона";
        }
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          newErrors.email = "Введите корректный email";
        }
      }
    }
    
    // Validate password
    if (password.length < 6) {
      newErrors.password = "Пароль должен содержать минимум 6 символов";
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Пароли не совпадают";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (password.length < 6) {
      newErrors.password = "Пароль должен содержать минимум 6 символов";
    }
    
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Пароли не совпадают";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) return;

    setLoading(true);
    try {
      // Determine if it's email or phone
      let emailToUse = loginIdentifier;
      
      // If it looks like a phone number, convert to email format
      if (loginIdentifier.startsWith("+") || /^\d/.test(loginIdentifier)) {
        const phoneDigits = loginIdentifier.replace(/\D/g, "");
        emailToUse = `${phoneDigits}@phone.prodent.uz`;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Неверный логин или пароль");
        }
        throw error;
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", rememberMe.toString());
      if (!rememberMe) {
        sessionStorage.setItem("activeSession", "true");
      }

      toast.success("Вход выполнен!");
      setStep("complete");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      toast.error(err.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!validateRegisterForm()) return;

    setLoading(true);
    try {
      const phoneDigits = "+" + phone.replace(/\D/g, "");
      const fullNameCombined = role === "clinic" 
        ? clinicName.trim()
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();
      
      const contact = verificationMethod === "phone" ? phoneDigits : email;
      
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: {
          phone: phoneDigits,
          role: role,
          full_name: fullNameCombined,
          last_name: role !== "clinic" ? lastName.trim() : undefined,
          first_name: role !== "clinic" ? firstName.trim() : undefined,
          middle_name: role !== "clinic" ? middleName.trim() : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          email: email || undefined,
          action: "register",
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка отправки кода");
      }

      setMaskedContact(data.masked_phone || data.masked_email);
      setStep("otp");
      toast.success(verificationMethod === "phone" ? "SMS код отправлен" : "Код отправлен на email");
    } catch (err: any) {
      toast.error(getErrorMessage(err, err?.message || "Ошибка отправки кода"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: "Введите 6-значный код" });
      return;
    }

    setLoading(true);
    try {
      const phoneDigits = "+" + phone.replace(/\D/g, "");
      const fullNameCombined = role === "clinic"
        ? clinicName.trim()
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();
      
      const contact = verificationMethod === "phone" ? phoneDigits : email;
      
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: {
          type: verificationMethod,
          contact: contact,
          code: otpCode,
          role: role,
          full_name: fullNameCombined,
          last_name: role !== "clinic" ? lastName.trim() : undefined,
          first_name: role !== "clinic" ? firstName.trim() : undefined,
          middle_name: role !== "clinic" ? middleName.trim() : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          password: password, // Pass password to set during verification
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка проверки кода");
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", "true");

      if (role === "doctor" || role === "clinic") {
        toast.success("Регистрация завершена! Заполните анкету.");
        setShowApplicationForm(true);
      } else {
        setStep("complete");
        toast.success("Регистрация завершена!");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err: any) {
      setErrors({ otp: getErrorMessage(err, err?.message || "Неверный код") });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!validatePasswordForm()) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Сессия истекла. Пожалуйста, начните регистрацию заново.");
      }

      const { data, error } = await supabase.functions.invoke("set-password", {
        body: { password },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка установки пароля");
      }

      // Store remember me preference
      localStorage.setItem("rememberMe", "true");

      if (role === "doctor" || role === "clinic") {
        toast.success("Пароль установлен! Заполните анкету.");
        setShowApplicationForm(true);
      } else {
        setStep("complete");
        toast.success("Регистрация завершена!");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err: any) {
      toast.error(err.message || "Ошибка установки пароля");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const contact = verificationMethod === "phone" ? "+" + phone.replace(/\D/g, "") : email;
    
    if (verificationMethod === "phone") {
      const phoneDigits = phone.replace(/\D/g, "");
      if (phoneDigits.length !== 12) {
        setErrors({ phone: "Введите корректный номер телефона" });
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrors({ email: "Введите корректный email" });
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reset-code", {
        body: {
          type: verificationMethod,
          contact: contact,
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка отправки кода");
      }

      setMaskedContact(data.masked_contact);
      setStep("otp");
      toast.success("Код восстановления отправлен");
    } catch (err: any) {
      toast.error(getErrorMessage(err, err?.message || "Ошибка отправки кода"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (otpCode.length !== 6) {
      setErrors({ otp: "Введите 6-значный код" });
      return;
    }

    if (!validatePasswordForm()) return;

    setLoading(true);
    try {
      const contact = verificationMethod === "phone" ? "+" + phone.replace(/\D/g, "") : email;
      
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: {
          type: verificationMethod,
          contact: contact,
          code: otpCode,
          new_password: password,
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка сброса пароля");
      }

      setStep("complete");
      toast.success("Пароль успешно изменён!");
      setTimeout(() => {
        setActiveTab("login");
        setStep("form");
        setPassword("");
        setConfirmPassword("");
        setOtpCode("");
      }, 2000);
    } catch (err: any) {
      setErrors({ otp: getErrorMessage(err, err?.message || "Ошибка") });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const phoneDigits = "+" + phone.replace(/\D/g, "");
      const contact = verificationMethod === "phone" ? phoneDigits : email;
      
      const { data, error } = await supabase.functions.invoke("resend-code", {
        body: {
          type: verificationMethod,
          contact: contact,
          action: activeTab === "forgot" ? "reset" : "register",
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка повторной отправки");
      }
      toast.success("Код отправлен повторно");
    } catch (err: any) {
      toast.error(getErrorMessage(err, err?.message || "Ошибка отправки кода"));
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    if (step === "otp" || step === "password") {
      setStep("form");
      setOtpCode("");
      setPassword("");
      setConfirmPassword("");
      setErrors({});
    }
  };

  const resetForm = () => {
    setStep("form");
    setOtpCode("");
    setPassword("");
    setConfirmPassword("");
    setErrors({});
    setPhone("+998");
    setEmail("");
    setLoginIdentifier("");
  };

  if (checkingPendingApplication && !showApplicationForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showApplicationForm && role === "doctor") {
    return <DoctorApplicationForm />;
  }

  if (showApplicationForm && role === "clinic") {
    return <ClinicApplicationForm />;
  }

  const roles = [
    { value: "patient" as Role, label: "Пациент", icon: User, color: "text-blue-500" },
    { value: "doctor" as Role, label: "Врач", icon: Stethoscope, color: "text-primary" },
    { value: "clinic" as Role, label: "Клиника", icon: Building2, color: "text-violet-500" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-sm border-border/50 shadow-xl">
          <CardHeader className="text-center pb-4">
            <img src={prodentLogo} alt="ProDent" className="h-10 mx-auto mb-3" />
            {step === "otp" ? (
              <>
                <h1 className="text-xl font-bold">Введите код</h1>
                <p className="text-sm text-muted-foreground">Отправлен на {maskedContact}</p>
              </>
            ) : step === "password" && activeTab === "forgot" ? (
              <>
                <h1 className="text-xl font-bold">Новый пароль</h1>
                <p className="text-sm text-muted-foreground">Введите новый пароль</p>
              </>
            ) : step === "complete" ? (
              <>
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-xl font-bold">Готово!</h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "forgot" ? "Пароль изменён" : "Перенаправление..."}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold">
                  {activeTab === "login" && "Вход"}
                  {activeTab === "register" && "Регистрация"}
                  {activeTab === "forgot" && "Восстановление пароля"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "login" && "Введите данные для входа"}
                  {activeTab === "register" && "Создайте аккаунт"}
                  {activeTab === "forgot" && "Введите контактные данные"}
                </p>
              </>
            )}
          </CardHeader>
          
          <CardContent className="space-y-4">
            {step === "form" && (
              <>
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); resetForm(); }}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="login">Вход</TabsTrigger>
                    <TabsTrigger value="register">Регистрация</TabsTrigger>
                  </TabsList>
                  
                  {/* LOGIN TAB */}
                  <TabsContent value="login" className="space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label>Email или телефон</Label>
                      <Input
                        type="text"
                        placeholder="email@example.com или +998..."
                        value={loginIdentifier}
                        onChange={(e) => { setLoginIdentifier(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.loginIdentifier && "border-destructive")}
                      />
                      {errors.loginIdentifier && <p className="text-xs text-destructive">{errors.loginIdentifier}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Пароль</Label>
                      <div className="relative">
                      <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="rememberMe" 
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
                          Запомнить меня
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("forgot")}
                        className="text-sm text-primary hover:underline"
                      >
                        Забыли пароль?
                      </button>
                    </div>
                    
                    <Button 
                      className="w-full h-11" 
                      onClick={handleLogin}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>Войти <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                  </TabsContent>
                  
                  {/* REGISTER TAB */}
                  <TabsContent value="register" className="space-y-4 mt-0">
                    {/* Role selector */}
                    <div className="space-y-2">
                      <Label>Кто вы?</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {roles.map((r) => {
                          const Icon = r.icon;
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => { setRole(r.value); setVerificationMethod("phone"); }}
                              className={cn(
                                "p-3 rounded-lg border-2 transition-all text-center",
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
                    </div>
                    
                    {role === "clinic" ? (
                      <div className="space-y-2">
                        <Label>Название клиники *</Label>
                        <Input
                          placeholder="Стоматология «Улыбка»"
                          value={clinicName}
                          onChange={(e) => { setClinicName(e.target.value); setErrors({}); }}
                          className={cn("h-11", errors.clinicName && "border-destructive")}
                        />
                        {errors.clinicName && <p className="text-xs text-destructive">{errors.clinicName}</p>}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label>Фамилия *</Label>
                            <Input
                              placeholder="Иванов"
                              value={lastName}
                              onChange={(e) => { setLastName(e.target.value); setErrors({}); }}
                              className={cn("h-10", errors.lastName && "border-destructive")}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Имя *</Label>
                            <Input
                              placeholder="Иван"
                              value={firstName}
                              onChange={(e) => { setFirstName(e.target.value); setErrors({}); }}
                              className={cn("h-10", errors.firstName && "border-destructive")}
                            />
                          </div>
                        </div>
                        {(errors.lastName || errors.firstName) && (
                          <p className="text-xs text-destructive">{errors.lastName || errors.firstName}</p>
                        )}
                      </>
                    )}
                    
                    {/* Verification method selector for patients */}
                    {role === "patient" && (
                      <div className="space-y-2">
                        <Label>Способ подтверждения</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setVerificationMethod("phone")}
                            className={cn(
                              "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                              verificationMethod === "phone"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <Phone className="w-4 h-4" />
                            <span className="text-sm">SMS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setVerificationMethod("email")}
                            className={cn(
                              "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                              verificationMethod === "email"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">Email</span>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Phone or Email input based on selection */}
                    {(role !== "patient" || verificationMethod === "phone") && (
                      <div className="space-y-2">
                        <Label>Номер телефона *</Label>
                        <Input
                          type="tel"
                          placeholder="+998 XX XXX XX XX"
                          value={phone}
                          onChange={handlePhoneChange}
                          className={cn("h-11", errors.phone && "border-destructive")}
                        />
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      </div>
                    )}
                    
                    {role === "patient" && verificationMethod === "email" && (
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          placeholder="example@mail.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                          className={cn("h-11", errors.email && "border-destructive")}
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>
                    )}
                    
                    {/* Password fields */}
                    <div className="space-y-2">
                      <Label>Пароль *</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Минимум 6 символов"
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Подтвердите пароль *</Label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Повторите пароль"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.confirmPassword && "border-destructive")}
                      />
                      {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                    </div>
                    
                    <Button 
                      className="w-full h-11" 
                      onClick={handleSendOtp}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>Получить код <ArrowRight className="w-4 h-4 ml-2" /></>
                      )}
                    </Button>
                    
                    {role !== "patient" && (
                      <p className="text-xs text-muted-foreground text-center">
                        После регистрации потребуется заполнить анкету для верификации
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
                
                {/* FORGOT PASSWORD */}
                {activeTab === "forgot" && (
                  <div className="space-y-4">
                    <button
                      onClick={() => { setActiveTab("login"); resetForm(); }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Назад к входу
                    </button>
                    
                    <div className="space-y-2">
                      <Label>Способ восстановления</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("phone")}
                          className={cn(
                            "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                            verificationMethod === "phone"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-sm">SMS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerificationMethod("email")}
                          className={cn(
                            "p-2 rounded-lg border-2 transition-all flex items-center justify-center gap-2",
                            verificationMethod === "email"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Mail className="w-4 h-4" />
                          <span className="text-sm">Email</span>
                        </button>
                      </div>
                    </div>
                    
                    {verificationMethod === "phone" ? (
                      <div className="space-y-2">
                        <Label>Номер телефона</Label>
                        <Input
                          type="tel"
                          placeholder="+998 XX XXX XX XX"
                          value={phone}
                          onChange={handlePhoneChange}
                          className={cn("h-11", errors.phone && "border-destructive")}
                        />
                        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          placeholder="example@mail.com"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
                          className={cn("h-11", errors.email && "border-destructive")}
                        />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>
                    )}
                    
                    <Button 
                      className="w-full h-11" 
                      onClick={handleForgotPassword}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>Получить код <KeyRound className="w-4 h-4 ml-2" /></>
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
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Изменить контакт
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
                      <Label>Новый пароль</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                          className={cn("h-11 pr-10", errors.password && "border-destructive")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Подтвердите пароль</Label>
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                        className={cn("h-11", errors.confirmPassword && "border-destructive")}
                      />
                      {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                    </div>
                  </>
                )}
                
                <Button 
                  className="w-full h-11" 
                  onClick={activeTab === "forgot" ? handleResetPassword : handleVerifyCode}
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    activeTab === "forgot" ? "Сменить пароль" : "Подтвердить"
                  )}
                </Button>
                
                <div className="text-center">
                  <button
                    onClick={handleResendCode}
                    disabled={resending}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    {resending ? "Отправка..." : "Отправить код повторно"}
                  </button>
                </div>
              </>
            )}
            
            {/* PASSWORD STEP (after OTP for registration) */}
            {step === "password" && activeTab === "register" && (
              <>
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Назад
                </button>
                
                <div className="space-y-2">
                  <Label>Пароль</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                      className={cn("h-11 pr-10", errors.password && "border-destructive")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label>Подтвердите пароль</Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                    className={cn("h-11", errors.confirmPassword && "border-destructive")}
                  />
                  {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                </div>
                
                <Button 
                  className="w-full h-11" 
                  onClick={handleSetPassword}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>Создать аккаунт <ArrowRight className="w-4 h-4 ml-2" /></>
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
