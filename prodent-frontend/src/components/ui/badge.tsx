import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",

        /* Статусные чипы по макету. Пары -fg/-bg уже проверены на контраст
           >= 4.5:1 в обеих темах (design-tokens-contrast.contract.test.ts),
           поэтому такой чип всегда читаем. Рамки нет: цвет несёт подложка.

           До этого в кабинете жили пять несовместимых форм чипа (rounded-md
           с весом 500, rounded-full с кольцом, прописные с разрядкой) и
           11 самописных карт статусов — «оплачено» в финансах и «принято» в
           расписании были разными зелёными. */
        ok: "border-transparent bg-status-success-bg text-status-success",
        warn: "border-transparent bg-status-warning-bg text-status-warning",
        danger: "border-transparent bg-status-danger-bg text-status-danger",
        info: "border-transparent bg-status-info-bg text-status-info",
        muted: "border-transparent bg-status-neutral-bg text-status-neutral",
      },
      /** Точка 6x6 текущим цветом слева, как в макете. */
      dot: {
        none: "",
        round:
          "gap-1.5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:content-['']",
        square:
          "gap-1.5 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-[2px] before:bg-current before:content-['']",
      },
    },
    defaultVariants: {
      variant: "default",
      dot: "none",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, dot, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, dot }), className)} {...props} />;
}

export { Badge, badgeVariants };
