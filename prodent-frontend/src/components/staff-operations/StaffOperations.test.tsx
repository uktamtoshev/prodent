import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({ currentClinic: { id: "clinic-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/lib/crm-operations-api", () => ({
  getClinicSchedule: vi.fn(),
  getReportSummary: vi.fn(),
  listClinicInvoices: vi.fn(),
  listReportOperations: vi.fn(),
  searchClinicPatients: vi.fn(),
}));

vi.mock("@/lib/sklad", () => ({
  sklad: {},
}));

import { PatientOperations } from "./StaffOperations";

function renderPatients() {
  return render(
    <MemoryRouter>
      <PatientOperations />
    </MemoryRouter>,
  );
}

describe("staff patient operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the backend name field before legacy name aliases", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue({
      data: [{
        id: "patient-1",
        name: "Backend Patient Name",
        full_name: "Legacy Full Name",
        fullName: "Legacy Camel Name",
        phone: "+998901234567",
      }],
      isError: false,
      isPending: false,
      refetch: mocks.refetch,
    });

    renderPatients();
    await user.type(screen.getByRole("textbox", {
      name: "Поиск пациентов",
    }), "Pa");

    expect(screen.getByText("Backend Patient Name")).toBeVisible();
    expect(screen.queryByText("Legacy Full Name")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy Camel Name")).not.toBeInTheDocument();
  });

  it("offers a 44px retry target and repeats a failed search", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isPending: false,
      refetch: mocks.refetch,
    });

    renderPatients();
    await user.type(screen.getByRole("textbox", {
      name: "Поиск пациентов",
    }), "Pa");

    const retry = screen.getByRole("button", { name: "Повторить" });
    expect(retry).toHaveClass("min-h-11");
    await user.click(retry);
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });
});
