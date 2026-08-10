import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    accessIsError: false,
    accessRefetch: vi.fn(),
    auth: { user: { id: "doctor-user-1" } as { id: string } | null },
    from: vi.fn(() => query),
    maybeSingle,
    query,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/crm/CRMLayout", () => ({
  CRMLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/crm/PermissionGate", () => ({
  PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/useMedicalAccess", () => ({
  getReasonLabel: (reason: string) => reason,
  useDoctorAccessRequests: () => ({
    data: [],
    isLoading: false,
    isError: mocks.accessIsError,
    refetch: mocks.accessRefetch,
  }),
  useExtendAccess: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import DoctorMedicalAccess from "./DoctorMedicalAccess";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DoctorMedicalAccess />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DoctorMedicalAccess error state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "doctor-user-1" };
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.accessIsError = false;
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error("doctor lookup failed"),
    });
  });

  it("shows a retry button when the doctor profile lookup fails", async () => {
    renderPage();

    expect(
      await screen.findByText("Не удалось загрузить доступы. Проверьте интернет и попробуйте снова."),
    ).toBeVisible();

    const retry = screen.getByRole("button", { name: /попробовать снова/i });
    expect(retry).toBeVisible();
  });

  it("retries the doctor lookup without refetching access rows before the doctor id is known", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /попробовать снова/i });
    expect(mocks.maybeSingle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /попробовать снова/i }));

    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(2));
    expect(mocks.accessRefetch).not.toHaveBeenCalled();
  });

  it("retries both doctor lookup and access rows when access rows fail after doctor id is known", async () => {
    const user = userEvent.setup();
    mocks.accessIsError = true;
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "doctor-1" },
      error: null,
    });

    renderPage();

    await screen.findByRole("button", { name: /попробовать снова/i });
    await user.click(screen.getByRole("button", { name: /попробовать снова/i }));

    await waitFor(() => expect(mocks.maybeSingle).toHaveBeenCalledTimes(2));
    expect(mocks.accessRefetch).toHaveBeenCalledTimes(1);
  });
});
