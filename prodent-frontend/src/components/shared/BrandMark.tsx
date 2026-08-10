import prodentLogo from "@/assets/prodent-logo.png";
import { cn } from "@/lib/utils";

/**
 * The PRODENT lockup: tooth mark + wordmark.
 *
 * Six places rendered the mark on its own — landing header, marketing header,
 * footer, auth card, registration flow and the cabinet sidebar — and a bare
 * icon is not a brand: a visitor who has never seen the tooth glyph has no way
 * to learn the product's name from it. One component instead of six copies of
 * the markup, so the lockup can never drift between the landing page and the
 * cabinet.
 *
 * Accessibility: the wordmark is REAL TEXT, so the image is decorative
 * (`alt=""` + aria-hidden). Leaving `alt="PRODENT"` on the icon would make a
 * screen reader announce the name twice in a row.
 *
 * Colour: the mark carries the brand hue, the word stays on a foreground token.
 * A coloured wordmark would need its own AA-checked pair on every surface it
 * lands on (white card, teal-ink sidebar, gradient hero); a foreground token is
 * correct on all of them by construction.
 */

type BrandMarkSize = "sm" | "md" | "lg";
type BrandMarkTone = "default" | "sidebar";

const SIZES: Record<BrandMarkSize, { icon: string; word: string; gap: string }> = {
  // The word is optically smaller than the mark, so the icon runs a step taller.
  sm: { icon: "h-8 w-8", word: "text-lg", gap: "gap-1.5" },
  md: { icon: "h-10 w-10", word: "text-xl", gap: "gap-2" },
  lg: { icon: "h-12 w-12", word: "text-2xl", gap: "gap-2.5" },
};

const TONES: Record<BrandMarkTone, string> = {
  default: "text-foreground",
  sidebar: "text-sidebar-text",
};

interface BrandMarkProps {
  size?: BrandMarkSize;
  tone?: BrandMarkTone;
  /** Hides the word below `sm` where the header genuinely has no room. */
  compact?: boolean;
  className?: string;
  /** Responsive overrides, e.g. `md:h-12 md:w-12`. */
  iconClassName?: string;
  wordClassName?: string;
}

export function BrandMark({
  size = "md",
  tone = "default",
  compact = false,
  className,
  iconClassName,
  wordClassName,
}: BrandMarkProps) {
  const scale = SIZES[size];
  return (
    <span className={cn("inline-flex items-center", scale.gap, className)}>
      <img
        src={prodentLogo}
        alt=""
        aria-hidden="true"
        className={cn("shrink-0 object-contain", scale.icon, iconClassName)}
      />
      <span
        className={cn(
          "font-heading font-bold uppercase leading-none tracking-wide",
          scale.word,
          TONES[tone],
          compact && "hidden sm:inline",
          wordClassName,
        )}
      >
        PRODENT
      </span>
    </span>
  );
}
