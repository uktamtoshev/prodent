import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle2, Sparkles, Shield, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RoleSelector } from "./RoleSelector";
import { PhoneInput } from "./PhoneInput";
import { OtpInput } from "./OtpInput";
import { OtpTimer } from "./OtpTimer";
import { VerificationMethodSelector } from "./VerificationMethodSelector";
import { LocationSelector } from "./LocationSelector";
import { getErrorMessage } from "@/lib/edge-function-error";
import { useLanguage } from "@/contexts/LanguageContext";

interface RegistrationFlowProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

type Step = "role" | "details" | "otp" | "additional" | "complete";
const LEGAL_DOCUMENT_VERSION = "2026-07-27";

export function RegistrationFlow({ onSuccess, onSwitchToLogin }: RegistrationFlowProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("role");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Form data
  const [role, setRole] = useState<string>("patient");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("+998");
  const [email, setEmail] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"phone" | "email">("phone");
  const [otpCode, setOtpCode] = useState("");
  const [additionalContact, setAdditionalContact] = useState("");
  const [maskedContact, setMaskedContact] = useState("");
  
  // Consent
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Location data
  const [country, setCountry] = useState(t("auth.uzbekistan"));
  const [region, setRegion] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const validateDetails = () => {
    const newErrors: Record<string, string> = {};

    if (role === "clinic") {
      if (!clinicName.trim() || clinicName.trim().length < 2) {
        newErrors.clinicName = t("auth.errClinicName");
      }
    } else {
      if (!lastName.trim() || lastName.trim().length < 2) {
        newErrors.lastName = t("auth.errLastName");
      }

      if (!firstName.trim() || firstName.trim().length < 2) {
        newErrors.firstName = t("auth.errFirstName");
      }
    }

    if (verificationMethod === "phone" || role !== "patient") {
      const phoneRegex = /^\+998\d{9}$/;
      if (!phoneRegex.test(phone)) {
        newErrors.phone = t("auth.errPhoneInvalid");
      }
    } else if (verificationMethod === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        newErrors.email = t("auth.errEmailInvalid");
      }
    }

    // Location validation
    if (!country) {
      newErrors.country = t("auth.errCountry");
    }
    if (!region) {
      newErrors.region = t("auth.errRegion");
    }
    // District is optional - not all regions have districts in DB
    if (!address.trim()) {
      newErrors.address = t("auth.errAddress");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validateDetails()) return;

    if (!consentAccepted) {
      toast.error(t("auth.acceptTermsRequired"));
      return;
    }

    setLoading(true);
    try {
      const fullNameCombined = role === "clinic"
        ? clinicName.trim()
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: {
          phone,
          role,
          full_name: fullNameCombined,
          last_name: role !== "clinic" ? lastName.trim() : undefined,
          first_name: role !== "clinic" ? firstName.trim() : undefined,
          middle_name: role !== "clinic" ? middleName.trim() || undefined : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          email: email || undefined,
          action: "register",
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

      setMaskedContact(data.masked_phone);
      setStep("otp");
      toast.success(t("auth.toastSmsSent"));
    } catch (err: unknown) {
      console.error("Error sending OTP:", err);
      toast.error(getErrorMessage(err, err instanceof Error ? err.message : t("auth.toastSendCodeError")));
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
      const fullNameCombined = role === "clinic"
        ? clinicName.trim()
        : `${lastName.trim()} ${firstName.trim()} ${middleName.trim()}`.trim();
      const { data, error } = await supabase.functions.invoke("verify-code", {
        body: {
          type: verificationMethod,
          contact: verificationMethod === "phone" ? phone : email,
          phone: verificationMethod === "phone" ? phone : email,
          code: otpCode,
          role,
          full_name: fullNameCombined,
          last_name: role !== "clinic" ? lastName.trim() : undefined,
          first_name: role !== "clinic" ? firstName.trim() : undefined,
          middle_name: role !== "clinic" ? middleName.trim() || undefined : undefined,
          clinic_name: role === "clinic" ? clinicName.trim() : undefined,
          additional_contact: additionalContact || undefined,
          action: "register",
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

      // Set session from response
      const accessToken = data.session?.access_token ?? data.access_token;
      const refreshToken = data.session?.refresh_token ?? data.refresh_token ?? "";
      if (accessToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }

      // For patients, ask for additional contact info
      if (role === "patient") {
        setStep("additional");
      } else {
        // For doctors and clinics, redirect to application form
        toast.success(t("auth.phoneVerified"));
        onSuccess(); // This will trigger Auth.tsx to show the application form
      }
    } catch (err: unknown) {
      console.error("Error verifying code:", err);
      setErrors({ otp: getErrorMessage(err, err instanceof Error ? err.message : t("auth.toastInvalidCode")) });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-code", {
        body: {
          type: verificationMethod,
          contact: verificationMethod === "phone" ? phone : email,
          action: "register",
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
      console.error("Error resending code:", err);
      toast.error(getErrorMessage(err, err instanceof Error ? err.message : t("auth.toastSendCodeError")));
    } finally {
      setResending(false);
    }
  };

  const handleCompleteRegistration = async () => {
    setLoading(true);
    try {
      // Update profile with additional contact and location
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const updateData: Record<string, unknown> = {
          country,
          region,
          district,
          address,
          latitude,
          longitude,
        };
        
        if (additionalContact) {
          if (verificationMethod === "phone") {
            updateData.email = additionalContact;
          } else {
            updateData.phone = additionalContact;
          }
        }

        await supabase
          .from("profiles")
          .update(updateData)
          .eq("id", user.id);
      }

      setStep("complete");
      toast.success(t("auth.toastRegisterDone"));
      setTimeout(onSuccess, 1500);
    } catch (error: unknown) {
      console.error("Error completing registration:", error);
      toast.error(t("auth.finishRegisterError"));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setErrors({});
    setOtpCode("");
    
    switch (step) {
      case "details":
        setStep("role");
        break;
      case "otp":
        setStep("details");
        break;
      case "additional":
        // Can't go back after verification
        break;
    }
  };

  // Step indicators
  const steps = [
    { key: "role", label: t("auth.stepRole") },
    { key: "details", label: t("auth.stepDetails") },
    { key: "otp", label: t("auth.stepCode") },
  ];
  
  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Glassmorphism card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
        {/* Gradient background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/5 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header */}
        <div className="relative px-6 pt-8 pb-6">
          {/* Back button */}
          {step !== "role" && step !== "complete" && (
            <button
              onClick={handleBack}
              disabled={loading || step === "additional"}
              className="absolute top-6 left-4 p-2 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          
          {/* Logo and title */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-teal-400 shadow-lg shadow-primary/30 mb-4">
              {step === "role" && <UserPlus className="w-8 h-8 text-white" />}
              {step === "details" && <Sparkles className="w-8 h-8 text-white" />}
              {step === "otp" && <Shield className="w-8 h-8 text-white" />}
              {step === "additional" && <Sparkles className="w-8 h-8 text-white" />}
              {step === "complete" && <CheckCircle2 className="w-8 h-8 text-white" />}
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {step === "role" && t("auth.registerCreate")}
              {step === "details" && (role === "patient" ? t("auth.registerTitle") : role === "doctor" ? t("auth.registerDoctor") : t("auth.registerClinic"))}
              {step === "otp" && t("auth.otpVerification")}
              {step === "additional" && t("auth.almostDone")}
              {step === "complete" && t("auth.welcome")}
            </h1>
            <p className="text-muted-foreground">
              {step === "role" && t("auth.pickAccountType")}
              {step === "details" && t("auth.fillYourData")}
              {step === "otp" && t("auth.enterOtp")}
              {step === "additional" && (verificationMethod === "phone" ? t("auth.addEmailForNotif") : t("auth.addPhoneNumber"))}
              {step === "complete" && t("auth.regSuccess")}
            </p>
          </div>
          
          {/* Progress steps */}
          {step !== "complete" && step !== "additional" && (
            <div className="flex items-center justify-center gap-2 mt-6">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                    i < currentStepIndex 
                      ? "bg-primary text-white" 
                      : i === currentStepIndex 
                        ? "bg-primary text-white ring-4 ring-primary/20" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {i < currentStepIndex ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`w-12 h-1 mx-1 rounded-full transition-colors ${
                      i < currentStepIndex ? "bg-primary" : "bg-muted"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="relative px-6 pb-8 space-y-6">
          {/* Step 1: Role Selection */}
          {step === "role" && (
            <>
              <RoleSelector value={role} onChange={setRole} disabled={loading} />
              <Button 
                className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]" 
                onClick={() => setStep("details")}
              >
                {t("auth.continue")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("auth.alreadyHaveAccount")}{" "}
                <button
                  onClick={onSwitchToLogin}
                  className="text-primary font-semibold hover:underline"
                >
                  {t("auth.loginLink")}
                </button>
              </p>
            </>
          )}

        {/* Step 2: Details Input */}
        {step === "details" && (
          <>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {role === "clinic" ? (
                <div className="space-y-2">
                  <Label htmlFor="clinicName">{t("auth.clinicNameRequired")}</Label>
                  <Input
                    id="clinicName"
                    placeholder={t("auth.clinicNamePlaceholderText")}
                    value={clinicName}
                    onChange={(e) => { setClinicName(e.target.value); if (e.target.value.trim().length >= 2) clearError("clinicName"); }}
                    disabled={loading}
                    className={errors.clinicName ? "border-destructive" : ""}
                  />
                  {errors.clinicName && <p className="text-sm text-destructive">{errors.clinicName}</p>}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("auth.lastNameRequired")}</Label>
                    <Input
                      id="lastName"
                      placeholder={t("auth.lastNamePh")}
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); if (e.target.value.trim().length >= 2) clearError("lastName"); }}
                      disabled={loading}
                      className={errors.lastName ? "border-destructive" : ""}
                    />
                    {errors.lastName && <p className="text-sm text-destructive">{errors.lastName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("auth.firstNameRequired")}</Label>
                    <Input
                      id="firstName"
                      placeholder={t("auth.firstNamePh")}
                      value={firstName}
                      onChange={(e) => { setFirstName(e.target.value); if (e.target.value.trim().length >= 2) clearError("firstName"); }}
                      disabled={loading}
                      className={errors.firstName ? "border-destructive" : ""}
                    />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="middleName">{t("auth.middleName")} <span className="text-muted-foreground text-xs">{t("auth.middleNameOptional")}</span></Label>
                    <Input
                      id="middleName"
                      placeholder={t("auth.middleNamePh")}
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {/* For patients, show verification method selector */}
              {role === "patient" && (
                <div className="space-y-2">
                  <Label>{t("auth.verificationMethodLabel")}</Label>
                  <VerificationMethodSelector
                    value={verificationMethod}
                    onChange={setVerificationMethod}
                    disabled={loading}
                  />
                </div>
              )}

              {/* Phone input (always for doctor/clinic, or if patient chose phone) */}
              {(role !== "patient" || verificationMethod === "phone") && (
                <PhoneInput
                  value={phone}
                  onChange={(value) => { setPhone(value); clearError("phone"); }}
                  error={errors.phone}
                  disabled={loading}
                />
              )}

              {/* Email input (only for patients who chose email) */}
              {role === "patient" && verificationMethod === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@mail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
                    disabled={loading}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
              )}

              {/* Optional email for phone verification */}
              {(role !== "patient" || verificationMethod === "phone") && (
                <div className="space-y-2">
                  <Label htmlFor="emailOptional">{t("auth.emailOptional")}</Label>
                  <Input
                    id="emailOptional"
                    type="email"
                    placeholder={t("auth.forNotificationsPlaceholder")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              )}

              {/* Location Selection */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm font-medium text-muted-foreground mb-3">{t("auth.location")}</p>
                <LocationSelector
                  country={country}
                  region={region}
                  district={district}
                  address={address}
                  latitude={latitude}
                  longitude={longitude}
                  onCountryChange={(value) => { setCountry(value); clearError("country"); clearError("region"); }}
                  onRegionChange={(value) => { setRegion(value); clearError("region"); }}
                  onDistrictChange={setDistrict}
                  onAddressChange={(value) => { setAddress(value); if (value.trim()) clearError("address"); }}
                  onLocationChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  disabled={loading}
                  errors={{
                    country: errors.country,
                    region: errors.region,
                    district: errors.district,
                    address: errors.address,
                  }}
                />
              </div>
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                {t("auth.iAccept")}{" "}
                <a href="/terms" target="_blank" className="text-primary hover:underline">{t("auth.termsLink")}</a>
                {" "}{t("auth.andLink")}{" "}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">{t("auth.privacyLink")}</a>,
                {" "}{t("auth.personalDataConsent")}
              </span>
            </label>

            <Button
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
              onClick={handleSendOtp}
              disabled={loading || !consentAccepted}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("auth.sending")}
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  {verificationMethod === "phone" ? t("auth.getCodeSms") : t("auth.getCodeEmail")}
                </>
              )}
            </Button>
          </>
        )}

        {/* Step 3: OTP Verification */}
        {step === "otp" && (
          <>
            <div className="text-center p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground">{t("auth.codeSentLabel")}</p>
              <p className="font-semibold text-foreground mt-1">{maskedContact}</p>
            </div>
            
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
              className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
              onClick={handleVerifyCode} 
              disabled={loading || otpCode.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("auth.checking")}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t("auth.confirm")}
                </>
              )}
            </Button>
          </>
        )}

        {/* Step 4: Additional Contact (Patients only) */}
        {step === "additional" && (
          <>
            <div className="space-y-4">
              {verificationMethod === "phone" ? (
                <div className="space-y-2">
                  <Label htmlFor="additionalEmail" className="text-base font-medium">{t("auth.additionalEmailLabel")}</Label>
                  <Input
                    id="additionalEmail"
                    type="email"
                    placeholder="example@mail.com"
                    value={additionalContact}
                    onChange={(e) => setAdditionalContact(e.target.value)}
                    disabled={loading}
                    className="h-12 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">{t("auth.forNotificationsHint")}</p>
                </div>
              ) : (
                <PhoneInput
                  value={additionalContact || "+998"}
                  onChange={setAdditionalContact}
                  disabled={loading}
                />
              )}
            </div>

            <div className="flex gap-3">
              {verificationMethod === "phone" && (
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-xl font-semibold" 
                  onClick={handleCompleteRegistration} 
                  disabled={loading}
                >
                  {t("auth.skip")}
                </Button>
              )}
              <Button
                className="flex-1 h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-teal-500 hover:from-primary/90 hover:to-teal-500/90 shadow-lg shadow-primary/25"
                onClick={handleCompleteRegistration}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("auth.saving")}
                  </>
                ) : (
                  t("auth.finish")
                )}
              </Button>
            </div>
          </>
        )}

        {/* Step 5: Complete */}
        {step === "complete" && (
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30 animate-[pulse_2s_ease-in-out_infinite]">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t("auth.welcomeProdent")}</h2>
            <p className="text-muted-foreground">{t("auth.redirectingDots")}</p>
            <div className="mt-4 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
