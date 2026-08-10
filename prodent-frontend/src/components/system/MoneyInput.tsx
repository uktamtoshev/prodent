import { forwardRef, type ChangeEvent, type ComponentPropsWithoutRef } from "react";

import { Input } from "@/components/ui/input";

export interface MoneyInputProps extends Omit<ComponentPropsWithoutRef<typeof Input>, "type" | "inputMode"> {
  currency?: string;
  decimalScale?: number;
  maxIntegralDigits?: number;
}

function normalizeMoneyValue(value: string, decimalScale = 2, maxIntegralDigits = 12) {
  const safeScale = Math.max(0, decimalScale);
  const safeIntegralDigits = Math.max(1, maxIntegralDigits);
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const [integer = "", ...fractionParts] = cleaned.split(".");
  const boundedInteger = integer.slice(0, safeIntegralDigits);

  if (fractionParts.length === 0 || safeScale === 0) {
    return boundedInteger;
  }

  return `${boundedInteger}.${fractionParts.join("").slice(0, safeScale)}`;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ currency, decimalScale = 2, maxIntegralDigits = 12, onChange, value, defaultValue, ...props }, ref) => {
    const normalize = (input: string) => normalizeMoneyValue(input, decimalScale, maxIntegralDigits);
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      event.currentTarget.value = normalize(event.currentTarget.value);
      onChange?.(event);
    };
    const normalizedValue = typeof value === "string" ? normalize(value) : value;
    const normalizedDefaultValue = typeof defaultValue === "string" ? normalize(defaultValue) : defaultValue;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="text"
          inputMode="decimal"
          pattern={`\\d{0,${Math.max(1, maxIntegralDigits)}}([\\.,]\\d{0,${Math.max(0, decimalScale)}})?`}
          maxLength={Math.max(1, maxIntegralDigits) + (decimalScale > 0 ? decimalScale + 1 : 0)}
          {...props}
          value={normalizedValue}
          defaultValue={normalizedDefaultValue}
          onChange={handleChange}
          className={currency ? `pr-14 ${props.className ?? ""}` : props.className}
        />
        {currency ? <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span> : null}
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
