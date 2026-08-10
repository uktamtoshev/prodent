import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Mail } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface VerificationMethodSelectorProps {
  value: "phone" | "email";
  onChange: (value: "phone" | "email") => void;
  disabled?: boolean;
}

export function VerificationMethodSelector({ value, onChange, disabled }: VerificationMethodSelectorProps) {
  const { t } = useLanguage();
  const methods = useMemo(() => [
    {
      value: "phone" as const,
      label: t("auth.methodPhone"),
      description: t("auth.methodPhoneDesc"),
      icon: Smartphone,
    },
    {
      value: "email" as const,
      label: t("auth.methodEmail"),
      description: t("auth.methodEmailDesc"),
      icon: Mail,
    },
  ], [t]);
  return (
    <div className="grid grid-cols-2 gap-4">
      {methods.map((method) => {
        const Icon = method.icon;
        const isSelected = value === method.value;
        
        return (
          <Card
            key={method.value}
            className={cn(
              "cursor-pointer transition-all hover:border-primary",
              isSelected && "border-primary ring-2 ring-primary ring-offset-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => !disabled && onChange(method.value)}
          >
            <CardContent className="p-4 text-center">
              <div className={cn(
                "mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2",
                isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
              )}>
                <Icon className="w-6 h-6" />
              </div>
              <p className="font-medium text-sm">{method.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{method.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
