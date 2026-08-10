import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { Input } from "@/components/ui/input";

export type PhoneInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "inputMode">;

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(({ autoComplete = "tel", ...props }, ref) => (
  <Input ref={ref} type="tel" inputMode="tel" autoComplete={autoComplete} {...props} />
));
PhoneInput.displayName = "PhoneInput";
