import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function PatientOfflineBanner() {
  const { t } = useLanguage();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sticky top-16 z-30 flex items-center justify-center gap-2 border-b border-warning-amber/30 bg-warning-amber/10 px-4 py-2 text-sm font-medium text-warning-amber lg:top-0"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {t("patientCabinet.offlineStatus")}
    </div>
  );
}
