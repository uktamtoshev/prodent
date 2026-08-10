import {
  Award,
  BadgePercent,
  Building2,
  Crown,
  Gem,
  Heart,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Zap,
} from "lucide-react";
import { describe, expect, it } from "vitest";

import { BILLING_ICON_MAP, resolveBillingIcon } from "./billingIconMap";

describe("billing icon map", () => {
  it("keeps the complete supported icon contract explicit", () => {
    expect(BILLING_ICON_MAP).toEqual({
      Award,
      Crown,
      ThumbsUp,
      Gem,
      Sparkles,
      Heart,
      Zap,
      BadgePercent,
      Building2,
      TrendingUp,
      Star,
    });
  });

  it("falls back to Award for unknown or missing icon names", () => {
    expect(resolveBillingIcon("UnknownIcon")).toBe(Award);
    expect(resolveBillingIcon(null)).toBe(Award);
    expect(resolveBillingIcon(undefined)).toBe(Award);
  });
});
