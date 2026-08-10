import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { Input } from "@/components/ui/input";

export type DateInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type">;

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>((props, ref) => (
  <Input ref={ref} type="date" {...props} />
));
DateInput.displayName = "DateInput";
