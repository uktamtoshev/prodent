import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  duplicatesRefetch: vi.fn(),
  mergeMutate: vi.fn(),
  patientsRefetch: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/components/crm/CRMLayout", () => ({
  CRMLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({ currentClinic: { id: "clinic-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/crm-operations-api", () => ({
  clearPersistentClientRequestId: vi.fn(),
  getPersistentClientRequestId: vi.fn(() => "request-1"),
  listDuplicatePatients: vi.fn(),
  mergeDuplicatePatients: vi.fn(),
  searchClinicPatients: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import Patients from "./Patients";

const duplicateGroup = {
  phone_normalized: "998901234567",
  duplicate_count: 2,
  guests: [
    { id: "guest-1", name: "Guest One", phone: "+998901234567" },
    { id: "guest-2", name: "Guest Two", phone: "+998901234567" },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Patients />
    </MemoryRouter>,
  );
}

describe("CRM patients destructive-action safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMutation.mockReturnValue({
      isPending: false,
      mutate: mocks.mergeMutate,
    });
    mocks.useQuery.mockImplementation(({ queryKey }: {
      queryKey: readonly unknown[];
    }) => queryKey[0] === "s7-patient-duplicates"
      ? {
          data: [duplicateGroup],
          isLoading: false,
          isError: false,
          refetch: mocks.duplicatesRefetch,
        }
      : {
          data: [],
          isLoading: false,
          isError: false,
          refetch: mocks.patientsRefetch,
        });
  });

  it("does not merge duplicates before explicit confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    const openConfirmation = screen.getByRole("button", {
      name: "crmPatientSearch.merge",
    });
    expect(openConfirmation).toHaveClass("min-h-11");
    await user.click(openConfirmation);

    expect(mocks.mergeMutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Guest One");
    expect(dialog).toHaveTextContent("Guest Two");

    await user.click(within(dialog).getByRole("button", {
      name: "crmPatientSearch.merge",
    }));
    expect(mocks.mergeMutate).toHaveBeenCalledWith(duplicateGroup);
  });

  it("shows a retry action when duplicate loading fails", async () => {
    const user = userEvent.setup();
    mocks.useQuery.mockImplementation(({ queryKey }: {
      queryKey: readonly unknown[];
    }) => queryKey[0] === "s7-patient-duplicates"
      ? {
          data: undefined,
          isLoading: false,
          isError: true,
          refetch: mocks.duplicatesRefetch,
        }
      : {
          data: [],
          isLoading: false,
          isError: false,
          refetch: mocks.patientsRefetch,
        });

    renderPage();

    const alert = screen.getByRole("alert");
    const retry = within(alert).getByRole("button", {
      name: "crmPatientSearch.retry",
    });
    expect(retry).toHaveClass("min-h-11");
    await user.click(retry);
    expect(mocks.duplicatesRefetch).toHaveBeenCalledOnce();
  });
});
