import { User, Stethoscope, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const roles = [
  {
    value: "patient",
    label: "Пациент",
    description: "Найти врача",
    icon: User,
    gradient: "from-blue-500 to-cyan-500",
    bgGradient: "from-blue-500/10 to-cyan-500/10",
  },
  {
    value: "doctor",
    label: "Врач",
    description: "Развивать практику",
    icon: Stethoscope,
    gradient: "from-primary to-teal-400",
    bgGradient: "from-primary/10 to-teal-400/10",
  },
  {
    value: "clinic",
    label: "Клиника",
    description: "Управлять клиникой",
    icon: Building2,
    gradient: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-500/10 to-purple-500/10",
  },
];

export function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  return (
    <div className="grid gap-3">
      {roles.map((role) => {
        const Icon = role.icon;
        const isSelected = value === role.value;
        
        return (
          <button
            key={role.value}
            type="button"
            className={cn(
              "relative w-full p-4 rounded-xl border-2 transition-all duration-300 text-left group",
              "hover:scale-[1.02] active:scale-[0.98]",
              isSelected 
                ? "border-primary bg-gradient-to-r " + role.bgGradient + " shadow-lg shadow-primary/20" 
                : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-gradient-to-r hover:" + role.bgGradient,
              disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
            onClick={() => !disabled && onChange(role.value)}
            disabled={disabled}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                isSelected 
                  ? "bg-gradient-to-br " + role.gradient + " text-white shadow-lg" 
                  : "bg-muted group-hover:bg-gradient-to-br group-hover:" + role.gradient + " group-hover:text-white"
              )}>
                <Icon className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <p className={cn(
                  "font-semibold text-lg transition-colors",
                  isSelected ? "text-primary" : "text-foreground"
                )}>{role.label}</p>
                <p className="text-sm text-muted-foreground">{role.description}</p>
              </div>
              <div className={cn(
                "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300",
                isSelected 
                  ? "border-primary bg-primary" 
                  : "border-muted-foreground/30"
              )}>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
