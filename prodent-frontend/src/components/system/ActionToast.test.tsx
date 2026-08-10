import { describe, expect, it, vi } from "vitest";

const { success, error, info } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => null,
  toast: { success, error, info },
}));

import { actionToast } from "./action-toast";

describe("actionToast", () => {
  it("passes a retry action to the success toast", () => {
    const retry = vi.fn();
    actionToast.success("Сохранено", { actionLabel: "Повторить", onAction: retry });
    expect(success).toHaveBeenCalledWith("Сохранено", expect.objectContaining({
      action: { label: "Повторить", onClick: retry },
    }));
  });
});
