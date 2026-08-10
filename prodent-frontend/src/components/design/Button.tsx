import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline" | "soft" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

export interface DesignButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] rounded-[10px]",
  md: "h-10 px-4 text-[14px] rounded-[12px]",
  lg: "h-12 px-5 text-[15px] rounded-[12px]",
};

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft",
  ghost: "text-foreground hover:bg-muted",
  outline: "border border-border bg-background text-foreground hover:bg-muted",
  soft: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  dark: "bg-foreground text-background hover:bg-foreground/90",
};

export const DesignButton = forwardRef<HTMLButtonElement, DesignButtonProps>(
  ({ variant = "primary", size = "md", icon, iconRight, children, className, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          sizes[size],
          variants[variant],
          className
        )}
        {...rest}
      >
        {icon}
        {children}
        {iconRight}
      </button>
    );
  }
);

DesignButton.displayName = "DesignButton";
