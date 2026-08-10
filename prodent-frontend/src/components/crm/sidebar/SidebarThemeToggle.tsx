import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/contexts/LanguageContext";

interface SidebarThemeToggleProps {
  collapsed: boolean;
}

export function SidebarThemeToggle({ collapsed }: SidebarThemeToggleProps) {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isLight = theme === "light";

  const handleToggle = () => {
    setTheme(isLight ? "dark" : "light");
  };

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={handleToggle}
          >
            {isLight ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {isLight ? t('crmSidebarMisc.darkTheme') : t('crmSidebarMisc.lightTheme')}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 px-3 text-xs gap-2"
      onClick={handleToggle}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5" />
          {t('crmSidebarMisc.darkTheme')}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          {t('crmSidebarMisc.lightTheme')}
        </>
      )}
    </Button>
  );
}
