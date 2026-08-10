import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Макет: вкладки стоят прямо на холсте, без серой полосы-подложки, и
      // активная «врастает» в содержимое под собой. Полоса скрадывала эту связь
      // и добавляла лишний слой. max-w-full / overflow-x-auto / justify-start
      // трогать нельзя — их держит responsive-primitives.test.tsx.
      "inline-flex max-w-full items-center justify-start gap-0.5 overflow-x-auto text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Геометрия макета: 8px/13px, 13.5px/500, скруглены только сверху —
      // язычок садится на содержимое. cabinet-control возвращает 44px на
      // касании: сама по себе вкладка выходит около 34px.
      "cabinet-control inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-t-field px-3 py-2 text-cell font-medium ring-offset-background transition-all duration-150",
      "relative overflow-hidden",
      // Активная — карточкой. На светлом холсте разница карточки и фона всего
      // 1.17:1, поэтому одной заливки мало: границу сверху и по бокам держит
      // рамка, иначе активную вкладку не отличить от соседних.
      "data-[state=active]:border data-[state=active]:border-b-0 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-soft",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      "hover:text-foreground",
      // Underline animation
      "after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200",
      "data-[state=active]:after:scale-x-100",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "animate-prodent-fade-in",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
