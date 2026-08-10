import { useModulePermissions, ModuleName, PermissionLevel } from "@/hooks/useModulePermissions";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

interface PermissionGateProps {
  module: ModuleName;
  level?: PermissionLevel;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  silent?: boolean; // If true, renders nothing instead of access denied
}

export function PermissionGate({
  module,
  level = "view",
  children,
  fallback,
  silent = false,
}: PermissionGateProps) {
  const { t } = useLanguage();
  const { hasPermission, isLoading } = useModulePermissions();

  if (isLoading) return null;

  if (!hasPermission(module, level)) {
    if (silent) return null;
    if (fallback) return <>{fallback}</>;

    return (
      <Card className="border-border/50 bg-card/80">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ShieldAlert className="w-12 h-12 mb-4 opacity-50 text-destructive" />
          <p className="text-lg font-medium text-foreground mb-1">{t('crmTopLevel.accessRestricted')}</p>
          <p className="text-sm">{t('crmTopLevel.noPermission')}</p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
