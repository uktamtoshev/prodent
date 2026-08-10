import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  onSuccess: vi.fn(),
  getEligiblePatients: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/treatment-plans-api", () => ({
  getEligibleTreatmentPlanPatients: mocks.getEligiblePatients,
}));

vi.mock("@/components/crm/treatment/TreatmentPlanForm", () => ({
  TreatmentPlanForm: (props: {
    open: boolean;
    patientId: string;
    doctorId: string;
    clinicId: string;
    planPathPrefix: string;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (plan: { id: string }) => void;
  }) => props.open ? (
    <div
      data-testid="treatment-plan-form"
      data-patient-id={props.patientId}
      data-doctor-id={props.doctorId}
      data-clinic-id={props.clinicId}
      data-path-prefix={props.planPathPrefix}
    >
      <button type="button" onClick={() => props.onSuccess?.({ id: "plan-1" })}>
        save-plan
      </button>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        cancel-form
      </button>
    </div>
  ) : null,
}));

import { DoctorTreatmentPlanCreateFlow } from "./DoctorTreatmentPlanCreateFlow";
import { loadEligiblePatients } from "./treatmentPlanPatientEligibility";

const firstPage = {
  content: [
    { id: "patient-1", fullName: "Ali Valiyev", phone: "+998901112233" },
    { id: "patient-2", fullName: "Zarina Karimova", phone: null },
  ],
  page: 0,
  size: 50,
  hasNext: false,
};

describe("DoctorTreatmentPlanCreateFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEligiblePatients.mockResolvedValue(firstPage);
    mocks.useQuery.mockReturnValue({
      data: firstPage,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("passes the selected doctor, clinic and patient to the single V87 form", async () => {
    const onOpenChange = vi.fn();
    render(
      <DoctorTreatmentPlanCreateFlow
        open
        onOpenChange={onOpenChange}
        doctorId="doctor-1"
        clinics={[{ id: "clinic-1", name: "Prodent Clinic" }]}
        initialClinicId="clinic-1"
        onSuccess={mocks.onSuccess}
      />,
    );

    await waitFor(() => expect(screen.getByText("Ali Valiyev")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Ali Valiyev/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));

    const form = screen.getByTestId("treatment-plan-form");
    expect(form).toHaveAttribute("data-doctor-id", "doctor-1");
    expect(form).toHaveAttribute("data-clinic-id", "clinic-1");
    expect(form).toHaveAttribute("data-patient-id", "patient-1");
    expect(form).toHaveAttribute("data-path-prefix", "/doctor/treatment-plans");

    fireEvent.click(screen.getByRole("button", { name: "save-plan" }));
    expect(mocks.onSuccess).toHaveBeenCalledWith({ id: "plan-1" });
  });

  it("closes cleanly from selection and from the shared form", () => {
    const onOpenChange = vi.fn();
    render(
      <DoctorTreatmentPlanCreateFlow
        open
        onOpenChange={onOpenChange}
        doctorId="doctor-1"
        clinics={[{ id: "clinic-1", name: "Prodent Clinic" }]}
        initialClinicId="clinic-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Zarina Karimova/ }));
    fireEvent.click(screen.getByRole("button", { name: "common.next" }));
    fireEvent.click(screen.getByRole("button", { name: "cancel-form" }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it("loads a bounded server page instead of reading protected generic tables", async () => {
    const signal = new AbortController().signal;
    await expect(loadEligiblePatients("clinic-2", "Ali", 3, 50, signal))
      .resolves.toEqual(firstPage);

    expect(mocks.getEligiblePatients).toHaveBeenCalledWith({
      clinicId: "clinic-2",
      search: "Ali",
      page: 3,
      size: 50,
      signal,
    });
  });

  it("sends search and pagination state to the dedicated endpoint loader", async () => {
    vi.useFakeTimers();
    mocks.useQuery.mockReturnValue({
      data: { ...firstPage, hasNext: true },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    try {
      render(
        <DoctorTreatmentPlanCreateFlow
          open
          onOpenChange={vi.fn()}
          doctorId="doctor-1"
          clinics={[{ id: "clinic-1", name: "Prodent Clinic" }]}
        />,
      );

      fireEvent.change(screen.getByLabelText("doctorTreatmentPlans.patient"), {
        target: { value: "  Zarina  " },
      });
      const beforeDebounce = mocks.useQuery.mock.calls.at(-1)?.[0];
      expect(beforeDebounce.queryKey).toContain("");

      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      const signal = new AbortController().signal;
      const latestSearchQuery = mocks.useQuery.mock.calls.at(-1)?.[0];
      await latestSearchQuery.queryFn({ signal });
      expect(mocks.getEligiblePatients).toHaveBeenLastCalledWith({
        clinicId: "clinic-1",
        search: "Zarina",
        page: 0,
        size: 50,
        signal,
      });

      const nextButtons = screen.getAllByRole("button", { name: "common.next" });
      expect(nextButtons).toHaveLength(2);
      fireEvent.click(nextButtons[0]);
      const latestPageQuery = mocks.useQuery.mock.calls.at(-1)?.[0];
      await latestPageQuery.queryFn({ signal });
      expect(mocks.getEligiblePatients).toHaveBeenLastCalledWith({
        clinicId: "clinic-1",
        search: "Zarina",
        page: 1,
        size: 50,
        signal,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses existing translated labels for the empty state and next action", () => {
    mocks.useQuery.mockReturnValue({
      data: { content: [], page: 0, size: 50, hasNext: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(
      <DoctorTreatmentPlanCreateFlow
        open
        onOpenChange={vi.fn()}
        doctorId="doctor-1"
        clinics={[{ id: "clinic-1", name: "Prodent Clinic" }]}
      />,
    );

    expect(screen.getByText("doctorPatients.patientsNotFound")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.next" })).toBeDisabled();
  });
});
