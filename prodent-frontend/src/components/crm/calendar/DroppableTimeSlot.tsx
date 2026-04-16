import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DroppableTimeSlotProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const DroppableTimeSlot = ({ id, children, className }: DroppableTimeSlotProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] p-2 border-r space-y-2 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/30 ring-inset",
        className
      )}
    >
      {children}
    </div>
  );
};
