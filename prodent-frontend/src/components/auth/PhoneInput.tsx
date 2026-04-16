import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const COUNTRY_CODES = [
  { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+7", flag: "🇰🇿", name: "Kazakhstan" },
];

export function PhoneInput({ value, onChange, error, disabled }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState("+998");

  // Extract the phone number without country code
  const phoneWithoutCode = value.startsWith(countryCode) 
    ? value.slice(countryCode.length) 
    : value.replace(/^\+\d+/, "");

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const digits = e.target.value.replace(/\D/g, "");
    // Limit to 9 digits for Uzbekistan
    const limited = digits.slice(0, 9);
    onChange(countryCode + limited);
  };

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    onChange(newCode + phoneWithoutCode);
  };

  // Format phone for display (keeps partial input; XX XXX XX XX)
  const formatPhone = (digits: string) => {
    if (!digits) return "";

    const cleaned = digits.replace(/\D/g, "");
    const p1 = cleaned.slice(0, 2);
    const p2 = cleaned.slice(2, 5);
    const p3 = cleaned.slice(5, 7);
    const p4 = cleaned.slice(7, 9);

    return [p1, p2, p3, p4].filter(Boolean).join(" ");
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="phone" className="text-base font-medium">Телефон</Label>
      <div className="flex gap-2">
        <Select value={countryCode} onValueChange={handleCountryChange} disabled={disabled}>
          <SelectTrigger className="w-[110px] h-12 rounded-xl bg-muted/50 border-border/50 font-medium">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span className="text-lg">{COUNTRY_CODES.find(c => c.code === countryCode)?.flag}</span>
                <span>{countryCode}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {COUNTRY_CODES.map((country, index) => (
              <SelectItem key={`${country.code}-${index}`} value={country.code} className="rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="text-lg">{country.flag}</span>
                  <span>{country.code}</span>
                  <span className="text-muted-foreground">({country.name})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id="phone"
          type="tel"
          placeholder="90 123 45 67"
          value={formatPhone(phoneWithoutCode)}
          onChange={handlePhoneChange}
          disabled={disabled}
          className={`flex-1 h-12 rounded-xl text-lg font-medium tracking-wide ${error ? "border-destructive ring-2 ring-destructive/20" : "border-border/50"}`}
        />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-destructive">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
