import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OtpTimer } from "./OtpTimer";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({
        "auth.resendIn": "Повторить через",
        "auth.resendCodeBtn": "Отправить повторно",
      })[key] ?? key,
  }),
}));

describe("OtpTimer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks resend until the cooldown expires and restarts it after resend", async () => {
    vi.useFakeTimers();
    const onResend = vi.fn();
    render(<OtpTimer initialSeconds={2} onResend={onResend} />);

    expect(screen.queryByRole("button", { name: /отправить повторно/i })).toBeNull();
    expect(screen.getByText(/00:02/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_100);
    });

    const resend = screen.getByRole("button", { name: /отправить повторно/i });
    fireEvent.click(resend);
    expect(onResend).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: /отправить повторно/i })).toBeNull();
    expect(screen.getByText(/00:02/)).toBeInTheDocument();
  });
});
