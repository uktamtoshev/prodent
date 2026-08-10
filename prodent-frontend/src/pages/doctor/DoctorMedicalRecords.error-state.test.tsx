import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMocks = vi.hoisted(() => ({
  mode: "supporting" as
    | "supporting"
    | "picker-doctor-error"
    | "picker-patients-error"
    | "conditions-error"
    | "clinical-doctor-error"
    | "clinical-doctor-missing"
    | "clinical-doctor-ready",
  refetchDoctor: vi.fn(),
  refetchClinicalDoctor: vi.fn(),
  refetchPatients: vi.fn(),
  refetchConditions: vi.fn(),
  refetchPlans: vi.fn(),
  refetchVisits: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    const common = {
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    };
    switch (queryKey[0]) {
      case "doctor-medical-record-access":
        return { ...common, data: { hasAccess: true } };
      case "patient-medical":
        return {
          ...common,
          data: {
            avatar_url: null,
            email: null,
            full_name: "Patient One",
            id: "patient-1",
            phone: null,
          },
        };
      case "current-doctor":
        return {
          ...common,
          data: { id: "doctor-1" },
          isError: queryMocks.mode === "picker-doctor-error",
          refetch: queryMocks.refetchDoctor,
        };
      case "clinical-alerts-doctor":
        return {
          ...common,
          data:
            queryMocks.mode === "clinical-doctor-missing"
              ? null
              : { clinic_id: "clinic-1", id: "doctor-1" },
          isError: queryMocks.mode === "clinical-doctor-error",
          refetch: queryMocks.refetchClinicalDoctor,
        };
      case "medical-records-patients":
        return {
          ...common,
          data: [],
          isError: queryMocks.mode === "picker-patients-error",
          refetch: queryMocks.refetchPatients,
        };
      case "patient-visits":
        return {
          ...common,
          data: [],
          isError: queryMocks.mode === "supporting",
          refetch: queryMocks.refetchVisits,
        };
      case "patient-plans":
        return {
          ...common,
          data: [],
          isError: queryMocks.mode === "supporting",
          refetch: queryMocks.refetchPlans,
        };
      case "medical-conditions":
        return {
          ...common,
          data: [],
          isError: queryMocks.mode === "conditions-error",
          refetch: queryMocks.refetchConditions,
        };
      default:
        return { ...common, data: [] };
    }
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/doctor/DoctorLayout", () => ({
  DoctorLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/doctor/DoctorTopbar", () => ({
  DoctorTopbar: () => null,
}));
vi.mock("@/components/doctor/AddMedicalConditionDialog", () => ({
  AddMedicalConditionDialog: ({
    clinicId,
    doctorId,
    open,
  }: {
    clinicId: string | null;
    doctorId: string | null;
    open: boolean;
  }) =>
    open ? (
      <div
        data-clinic-id={clinicId ?? ""}
        data-doctor-id={doctorId ?? ""}
        data-testid="medical-condition-dialog"
      />
    ) : null,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/medical-record-api", () => ({
  getPatientMedicalRecords: vi.fn(),
}));
vi.mock("@/lib/medical-access-api", () => ({
  medicalAccessApi: { effective: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import DoctorMedicalRecords from "./DoctorMedicalRecords";

describe("DoctorMedicalRecords supporting data errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMocks.mode = "supporting";
  });

  it("shows a clear alert and retries each failed supporting query", () => {
    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Данные врача, визитов или планов лечения загрузились не полностью.",
    );
    expect(
      screen.queryByText("doctorMedicalRecords.noVisitsYet"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/doctorMedicalRecords\.visitNumber$/),
    ).toHaveTextContent("—doctorMedicalRecords.visitNumber");
    expect(
      screen.getByRole("button", {
        name: /^doctorMedicalRecords\.tabVisits\b/,
      }),
    ).not.toHaveTextContent("0");

    fireEvent.click(
      screen.getByRole("button", {
        name: /^doctorMedicalRecords\.tabVisits\b/,
      }),
    );
    expect(
      screen.queryByText("doctorMedicalRecords.noVisitsYet"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "doctorMedicalRecords.tabPlan" }),
    );
    expect(
      screen.queryByText("doctorMedicalRecords.noActivePlan"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    expect(queryMocks.refetchVisits).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchPlans).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchDoctor).not.toHaveBeenCalled();
  });

  it("shows and retries a doctor lookup error in the patient picker", () => {
    queryMocks.mode = "picker-doctor-error";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("common.error");
    expect(
      screen.queryByText("doctorMedicalRecords.noPatientsYet"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "common.retry" }),
    );

    expect(queryMocks.refetchDoctor).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchPatients).not.toHaveBeenCalled();
  });

  it("does not show a zero visit count when the detail doctor query fails", () => {
    queryMocks.mode = "picker-doctor-error";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/doctorMedicalRecords\.visitNumber$/),
    ).toHaveTextContent("—doctorMedicalRecords.visitNumber");
    expect(
      screen.getByRole("button", {
        name: /^doctorMedicalRecords\.tabVisits\b/,
      }),
    ).not.toHaveTextContent("0");
  });

  it("shows and retries a patient list error instead of claiming the list is empty", () => {
    queryMocks.mode = "picker-patients-error";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("common.error");
    expect(
      screen.queryByText("doctorMedicalRecords.noPatientsYet"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "common.retry" }),
    );

    expect(queryMocks.refetchPatients).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchDoctor).not.toHaveBeenCalled();
  });

  it("never shows a false empty allergies state when conditions fail", () => {
    queryMocks.mode = "conditions-error";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("common.error");
    expect(
      screen.queryByText("doctorMedicalRecords.notSpecified"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("doctorMedicalRecords.noAllergiesText"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "common.retry" }),
    );

    expect(queryMocks.refetchConditions).toHaveBeenCalledTimes(1);
  });

  it("shows and retries a clinical doctor context error", () => {
    queryMocks.mode = "clinical-doctor-error";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("common.error");
    expect(
      screen.queryByRole("button", {
        name: "doctorMedicalRecords.addAllergy",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "common.retry" }),
    );

    expect(queryMocks.refetchClinicalDoctor).toHaveBeenCalledTimes(1);
    expect(queryMocks.refetchConditions).not.toHaveBeenCalled();
  });

  it("does not open condition forms without a complete doctor context", () => {
    queryMocks.mode = "clinical-doctor-missing";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    const addAllergy = screen.getByRole("button", {
      name: "doctorMedicalRecords.addAllergy",
    });
    const addComorbidity = screen.getByRole("button", {
      name: "doctorMedicalRecords.addComorbidity",
    });
    expect(addAllergy).toBeDisabled();
    expect(addComorbidity).toBeDisabled();

    fireEvent.click(addAllergy);
    fireEvent.click(addComorbidity);
    expect(
      screen.queryByTestId("medical-condition-dialog"),
    ).not.toBeInTheDocument();
  });

  it("opens a condition form only with complete doctor and clinic ids", () => {
    queryMocks.mode = "clinical-doctor-ready";

    render(
      <MemoryRouter initialEntries={["/doctor/medical-records?id=patient-1"]}>
        <DoctorMedicalRecords />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "doctorMedicalRecords.addAllergy",
      }),
    );

    expect(screen.getByTestId("medical-condition-dialog")).toHaveAttribute(
      "data-doctor-id",
      "doctor-1",
    );
    expect(screen.getByTestId("medical-condition-dialog")).toHaveAttribute(
      "data-clinic-id",
      "clinic-1",
    );
    expect(
      screen.getByText(/doctorMedicalRecords\.visitNumber$/),
    ).toHaveTextContent("0doctorMedicalRecords.visitNumber");
    expect(
      screen.getByRole("button", {
        name: /^doctorMedicalRecords\.tabVisits\b/,
      }),
    ).toHaveTextContent("0");
  });
});
