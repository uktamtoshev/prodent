import type { ReactNode } from "react";

import { toast } from "@/components/ui/sonner";

export interface ActionToastOptions {
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

function options({ description, actionLabel, onAction }: ActionToastOptions = {}) {
  return {
    description,
    action: actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined,
  };
}

export const actionToast = {
  success(message: ReactNode, config?: ActionToastOptions) {
    return toast.success(message, options(config));
  },
  error(message: ReactNode, config?: ActionToastOptions) {
    return toast.error(message, options(config));
  },
  info(message: ReactNode, config?: ActionToastOptions) {
    return toast.info(message, options(config));
  },
};
