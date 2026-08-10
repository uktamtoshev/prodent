import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Timer, RefreshCw } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface OtpTimerProps {
  initialSeconds: number;
  onResend: () => void;
  isResending?: boolean;
}

export function OtpTimer({ initialSeconds, onResend, isResending }: OtpTimerProps) {
  const { t } = useLanguage();
  const [seconds, setSeconds] = useState(initialSeconds);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    setSeconds(initialSeconds);
    setCanResend(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleResend = () => {
    onResend();
    setSeconds(initialSeconds);
    setCanResend(false);
  };

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      {!canResend ? (
        <>
          <Timer className="w-4 h-4" />
          <span>{t("auth.resendIn")} {formatTime(seconds)}</span>
        </>
      ) : (
        <Button
          variant="link"
          size="sm"
          onClick={handleResend}
          disabled={isResending}
          className="p-0 h-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isResending ? "animate-spin" : ""}`} />
          {t("auth.resendCodeBtn")}
        </Button>
      )}
    </div>
  );
}
