import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { Input } from "@/components/ui/input";

export type TimeInputProps = Omit<ComponentPropsWithoutRef<typeof Input>, "type">;

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>((props, ref) => (
  <Input ref={ref} type="time" {...props} />
));
TimeInput.displayName = "TimeInput";
