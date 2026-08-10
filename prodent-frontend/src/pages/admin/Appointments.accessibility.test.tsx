import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: "ru",
    t: (key: string) => key,
  }),
}));

import Appointments from "./Appointments";

describe("admin appointments accessibility and load states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an explicit error and retries the failed request", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: mocks.refetch,
    });

    render(<Appointments />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("common.error");
    await user.click(within(alert).getByRole("button", { name: "common.retry" }));

    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("renders a named responsive table with semantic column headings", () => {
    mocks.useQuery.mockReturnValue({
      data: [{
        id: "appointment-1",
        appointment_date: "2026-07-28T08:00:00.000Z",
        service: "Consultation",
        total_price: 150000,
        status: "CONFIRMED",
        patient: { full_name: "Patient One", phone: "+998901234567" },
        doctor: { profile: { full_name: "Doctor One" } },
      }],
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });

    render(<Appointments />);

    const table = screen.getByRole("table", { name: "adminAppointments.title" });
    expect(table).toHaveClass("min-w-[760px]");
    expect(screen.getByTestId("admin-appointments-table")).toHaveClass(
      "max-w-full",
      "overflow-hidden",
    );
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    for (const heading of within(table).getAllByRole("columnheader")) {
      expect(heading).toHaveAttribute("scope", "col");
    }
    expect(screen.getByRole("textbox", {
      name: "adminAppointments.searchPlaceholder",
    })).toHaveClass("min-h-11");
    expect(screen.getByRole("combobox", {
      name: "adminAppointments.colStatus",
    })).toHaveClass("min-h-11");
  });

  it("announces loading and empty results", () => {
    mocks.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: true,
      isError: false,
      refetch: mocks.refetch,
    });
    const { rerender } = render(<Appointments />);
    expect(screen.getByRole("status")).toHaveTextContent("admin.loading");

    mocks.useQuery.mockReturnValueOnce({
      data: [],
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });
    rerender(<Appointments />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "adminAppointments.notFound",
    );
  });
});
