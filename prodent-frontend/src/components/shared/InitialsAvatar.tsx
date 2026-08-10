import type { ReactNode } from "react";

import { avatarSwatchFor, initialsFor } from "@/lib/avatar-palette";
import { cn } from "@/lib/utils";

/**
 * The deterministic colour-per-name avatar used across the patient and doctor
 * cabinets. Eleven files had grown their own near-identical copy of it, which
 * is why one unreadable-initials bug needed eleven fixes.
 *
 * The colours, and the reasoning behind their foregrounds, live in
 * `@/lib/avatar-palette`.
 */
export interface InitialsAvatarProps {
  name: string;
  /** Diameter in px. */
  size?: number;
  /** Photo to show instead of initials, when there is one. */
  src?: string | null;
  /** Shown instead of initials for non-people (a clinic gets a building). */
  fallbackIcon?: ReactNode;
  /** Initials to fall back to when `name` yields none. */
  fallbackInitial?: string;
  className?: string;
}

export function InitialsAvatar({
  name,
  size = 40,
  src,
  fallbackIcon,
  fallbackInitial = "?",
  className,
}: InitialsAvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const { bg, fg } = avatarSwatchFor(name);
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: `hsl(${bg})`,
        color: `hsl(${fg})`,
        fontSize: size / 2.8,
      }}
    >
      {fallbackIcon || initialsFor(name, fallbackInitial)}
    </div>
  );
}

export default InitialsAvatar;
