import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PhoneInput } from "./PhoneInput";
import { OtpInput } from "./OtpInput";
import { OtpTimer } from "./OtpTimer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/edge-function-error";

interface LoginFlowProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

type Step = "method" | "contact" | "otp" | "complete";
type LoginMethod = "phone" | "email";

export function LoginFlow({ onSuccess, onSwitchToRegister }: LoginFlowProps) {
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<LoginMethod>("phone");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [maskedContact, setMaskedContact] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleMethodSelect = (selectedMethod: LoginMethod) => {
    setMethod(selectedMethod);
    setStep("contact");
    setErrors({});
  };

  const handleSendOtp = async () => {
    if (method === "phone") {
      const phoneRegex = /^\+998\d{9}$/;
      if (!phoneRegex.test(phone)) {
        setErrors({ contact: "Введите корректный номер телефона" });
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrors({ contact: "Введите корректный email" });
        return;
      }
    }

    setLoading(true);
    setErrors({});

    try {
      const contact = method === "phone" ? phone : email;
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: {
          [method]: contact,
          role: "patient",
          full_name: "Пользователь",
          action: "login",
          type: method,
        },
      });

      if (error) {
        throw new Error(error.message || "Ошибка сервера");
      }
      if (data?.success === false || data?.error) {
        throw new Error(data.error || "Ошибка отправки кода");
      }

      setMaskedContact(data.masked_phone || data.masked_email || contact);
      setStep("otp");
      toast.success(method === "phone" ? "SMS код отправлен" : "Код отправлен на email");
    } catch (err: any) {
      console.error("Error sending OTP:", err);
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
      const contact = method === "phone" ? phone : email;
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: {
          type: method,
          contact: contact,
          code: otpCode,
          role: "patient",
          full_name: "Пользователь",
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

      setStep("complete");
      toast.success("Вход выполнен!");
      setTimeout(onSuccess, 1500);
    } catch (err: any) {
      console.error("Error verifying code:", err);
      setErrors({ otp: getErrorMessage(err, err?.message || "Неверный код") });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const contact = method === "phone" ? phone : email;
      const { data, error } = await supabase.functions.invoke("resend-code", {
        body: {
          type: method,
          contact: contact,
          action: "login",
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
      console.error("Error resending code:", err);
      toast.error(getErrorMessage(err, err?.message || "Ошибка отправки кода"));
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    setErrors({});
    setOtpCode("");
    if (step === "otp") {
      setStep("contact");
    } else if (step === "contact") {
      setStep("method");
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case "method": return 1;
      case "contact": return 2;
      case "otp": return 3;
      case "complete": return 4;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress Bar */}
      {step !== "complete" && (
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                  getStepNumber() >= num
                    ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {num}
              </div>
            ))}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
              style={{ width: `${((getStepNumber() - 1) / 2) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          {(step === "contact" || step === "otp") && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBack} 
              disabled={loading}
              className="absolute left-4"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {step === "method" && "Выберите способ входа"}
            {step === "contact" && (method === "phone" ? "Введите телефон" : "Введите email")}
            {step === "otp" && "Подтверждение"}
            {step === "complete" && "Добро пожаловать!"}
          </h2>
        </div>
        <p className="text-muted-foreground">
          {step === "method" && "Войдите по телефону или email"}
          {step === "contact" && "Мы отправим вам код подтверждения"}
          {step === "otp" && `Код отправлен на ${maskedContact}`}
          {step === "complete" && "Вы успешно вошли в систему"}
        </p>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Step 1: Method Selection */}
        {step === "method" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleMethodSelect("phone")}
                className="group relative p-6 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                  <span className="font-medium">Телефон</span>
                  <span className="text-xs text-muted-foreground">SMS код</span>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect("email")}
                className="group relative p-6 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <span className="font-medium">Email</span>
                  <span className="text-xs text-muted-foreground">Код на почту</span>
                </div>
              </button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Button variant="link" className="p-0 h-auto font-semibold" onClick={onSwitchToRegister}>
                Зарегистрироваться
              </Button>
            </p>
          </>
        )}

        {/* Step 2: Contact Input */}
        {step === "contact" && (
          <>
            {method === "phone" ? (
              <PhoneInput
                value={phone}
                onChange={(val) => {
                  setPhone(val);
                  setErrors({});
                }}
                error={errors.contact}
                disabled={loading}
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email адрес
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors({});
                  }}
                  disabled={loading}
                  className={cn(
                    "h-12 text-lg",
                    errors.contact && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {errors.contact && (
                  <p className="text-sm text-destructive">{errors.contact}</p>
                )}
              </div>
            )}

            <Button 
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg" 
              onClick={handleSendOtp} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  {method === "phone" ? "Получить SMS код" : "Получить код на email"}
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Нет аккаунта?{" "}
              <Button variant="link" className="p-0 h-auto font-semibold" onClick={onSwitchToRegister}>
                Зарегистрироваться
              </Button>
            </p>
          </>
        )}

        {/* Step 3: OTP Verification */}
        {step === "otp" && (
          <>
            <OtpInput
              value={otpCode}
              onChange={(val) => {
                setOtpCode(val);
                setErrors({});
              }}
              error={errors.otp}
              disabled={loading}
            />

            <OtpTimer
              initialSeconds={300}
              onResend={handleResendCode}
              isResending={resending}
            />

            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
              onClick={handleVerifyCode}
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Проверка...
                </>
              ) : (
                "Войти"
              )}
            </Button>
          </>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-xl">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <p className="text-xl font-semibold mb-2">С возвращением!</p>
            <p className="text-muted-foreground">Перенаправление...</p>
          </div>
        )}
      </div>
    </div>
  );
}
