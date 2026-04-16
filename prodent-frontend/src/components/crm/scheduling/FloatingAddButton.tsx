import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingAddButtonProps {
  onClick: () => void;
  className?: string;
}

export const FloatingAddButton = ({ onClick, className }: FloatingAddButtonProps) => {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg",
        "bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100",
        "text-white dark:text-neutral-900",
        "transition-all duration-200 hover:scale-105 active:scale-95",
        "lg:hidden", // Only show on mobile/tablet
        className
      )}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
};
