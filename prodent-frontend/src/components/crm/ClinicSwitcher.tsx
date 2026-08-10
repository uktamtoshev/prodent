import { useClinic } from '@/contexts/ClinicContext';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { a11yLabel } from "@/lib/a11y-labels";

interface ClinicSwitcherProps {
  collapsed?: boolean;
}

export function ClinicSwitcher({ collapsed = false }: ClinicSwitcherProps) {
  const { t } = useLanguage();
  const { currentClinic, clinics, switchClinic, isSuperAdmin } = useClinic();
  const [open, setOpen] = useState(false);

  const ROLE_LABELS = useMemo<Record<string, string>>(() => ({
    super_admin: t('crmSidebarMisc.roleSuperAdmin'),
    clinic_admin: t('crmSidebarMisc.roleClinicAdmin'),
    clinic_manager: t('crmSidebarMisc.roleClinicManager'),
    doctor: t('crmSidebarMisc.roleDoctor'),
    assistant: t('crmSidebarMisc.roleAssistant'),
    accountant: t('crmSidebarMisc.roleAccountant'),
    patient: t('crmSidebarMisc.rolePatient'),
  }), [t]);

  if (clinics.length <= 1 && !isSuperAdmin) {
    return currentClinic ? (
      <div className={cn(
        "flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10",
        collapsed ? "justify-center p-2" : "px-2.5 py-2"
      )}>
        <div className="relative shrink-0">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-status-success" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{currentClinic.name}</p>
            <p className="text-xs text-muted-foreground">{t('crmSidebarMisc.online')}</p>
          </div>
        )}
      </div>
    ) : null;
  }

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-9 bg-primary/5 hover:bg-primary/10"
           aria-label={a11yLabel("clinic")}>
            <Building2 className="w-4 h-4 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" side="right">
          <Command>
            <CommandInput placeholder={t('crmSidebarMisc.clinicSearch')} />
            <CommandList>
              <CommandEmpty>{t('crmSidebarMisc.clinicsNotFound')}</CommandEmpty>
              <CommandGroup heading={t('crmSidebarMisc.yourClinics')}>
                {clinics.map((clinic) => (
                  <CommandItem
                    key={clinic.id}
                    value={clinic.id}
                    onSelect={() => {
                      switchClinic(clinic.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0',
                          currentClinic?.id === clinic.id
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      <span className="truncate">{clinic.name}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                      {ROLE_LABELS[clinic.role] || clinic.role}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-primary/5 border-primary/10 hover:bg-primary/10 h-auto py-2"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="relative shrink-0">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-status-success" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs font-medium truncate">{currentClinic?.name || t('crmSidebarMisc.selectClinic')}</p>
              <p className="text-xs text-muted-foreground">{t('crmSidebarMisc.online')}</p>
            </div>
          </div>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('crmSidebarMisc.clinicSearch')} />
          <CommandList>
            <CommandEmpty>{t('crmSidebarMisc.clinicsNotFound')}</CommandEmpty>
            <CommandGroup heading={t('crmSidebarMisc.yourClinics')}>
              {clinics.map((clinic) => (
                <CommandItem
                  key={clinic.id}
                  value={clinic.id}
                  onSelect={() => {
                    switchClinic(clinic.id);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0',
                        currentClinic?.id === clinic.id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <span className="truncate">{clinic.name}</span>
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                    {ROLE_LABELS[clinic.role] || clinic.role}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
