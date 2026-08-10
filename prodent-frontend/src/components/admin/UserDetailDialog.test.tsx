import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  selectedColumns: "",
  from: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  tGlobal: (key: string) => key,
  useLanguage: () => ({
    language: "ru",
    t: (key: string) => key,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import { UserDetailDialog } from "./UserDetailDialog";

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailDialog
        open
        onOpenChange={vi.fn()}
        user={{
          id: "patient-1",
          full_name: "Тест Пациент",
          email: "patient@example.test",
          phone: "+998900000000",
          created_at: "2026-07-24T00:00:00Z",
          roles: [{ id: "role-1", role: "patient" }],
        }}
      />
    </QueryClientProvider>,
  );
}

describe("admin safe support view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedColumns = "";

    mocks.from.mockImplementation((table: string) => {
      if (table === "appointments") {
        const query = {
          select: vi.fn((columns: string) => {
            mocks.selectedColumns = columns;
            return query;
          }),
          eq: vi.fn(() => query),
          limit: vi.fn(() => query),
          order: vi.fn().mockResolvedValue({
            data: [{
              id: "appointment-1",
              doctor_id: null,
              clinic_id: null,
              appointment_date: "2026-07-24",
              start_time: "10:00",
              status: "COMPLETED",
              total_price: 150000,
              service: "Консультация",
            }],
            error: null,
          }),
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("loads and renders only the support-safe appointment fields", async () => {
    renderDialog();

    expect(await screen.findByText("Консультация")).toBeVisible();
    expect(mocks.selectedColumns).toContain("service");
    expect(mocks.selectedColumns).not.toMatch(
      /diagnos|tooth|teeth|medical|doctor_note|treatment|file/i,
    );
    expect(screen.queryByText(/диагноз/i)).not.toBeInTheDocument();
  });
});
