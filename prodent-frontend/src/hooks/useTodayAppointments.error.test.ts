import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const order = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            lt: () => ({ order }),
          }),
        }),
      }),
    }),
  },
}));

import { useTodayAppointments } from "./useTodayAppointments";

/**
 * Упавший запрос не должен выглядеть как пустой день.
 *
 * Раньше хук брал из ответа только `data` и игнорировал `error`. При отказе
 * сервера он возвращал пустой массив, и «Главная» показывала «Приёмов сегодня
 * 0», «Завершено 0» — то есть уверенно утверждала, что день свободен. По
 * такому нулю принимают решение: брать ли срочного пациента, звонить ли
 * кому-то. Молчаливый ноль здесь опаснее пустого места.
 */
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

describe("useTodayAppointments · ошибка запроса", () => {
  beforeEach(() => {
    order.mockReset();
  });

  it("пробрасывает ошибку в React Query, а не отдаёт пустой список", async () => {
    order.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { result } = renderHook(() => useTodayAppointments("clinic-1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toContain("permission denied");
    // И главное: счётчики НЕ выглядят как настоящий пустой день.
    expect(result.current.isSuccess).toBe(false);
  });

  it("на успешном ответе считает срезы", async () => {
    order.mockResolvedValue({
      data: [
        { id: "1", status: "completed", appointment_date: "", service: null, notes: null, patient_id: null },
        { id: "2", status: "pending", appointment_date: "", service: null, notes: null, patient_id: null },
        { id: "3", status: "confirmed", appointment_date: "", service: null, notes: null, patient_id: null },
      ],
      error: null,
    });

    const { result } = renderHook(() => useTodayAppointments("clinic-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.counts).toEqual({ total: 3, completed: 1, pending: 1 });
  });
});
