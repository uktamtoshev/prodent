import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface DesignAvatarProps extends HTMLAttributes<HTMLDivElement> {
  name?: string;
  src?: string;
  size?: number;
}

const palette = [
  "bg-primary/15 text-primary",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground",
  "bg-accent text-accent-foreground",
  "bg-brand-100 text-brand-700",
  "bg-primary/10 text-primary",
];

function paletteFor(name: string) {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DesignAvatar({ name = "", src, size = 40, className, ...rest }: DesignAvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0 overflow-hidden",
        !src && paletteFor(name),
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        fontFamily: "Manrope, sans-serif",
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initialsFor(name)
      )}
    </div>
  );
}
