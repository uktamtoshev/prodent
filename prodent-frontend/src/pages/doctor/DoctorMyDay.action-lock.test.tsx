import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelAppointment: vi.fn(),
  invalidateQueries: vi.fn(),
  statusMaybeSingle: vi.fn(),
  timeRequests: [] as unknown[],
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateAppointmentStatus: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "doctor@example.test" } }),
}));

vi.mock("@/contexts/ClinicContext", () => ({
  useClinic: () => ({ currentClinic: { id: "clinic-1", name: "Clinic" } }),
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

vi.mock("@/components/crm/QuickAppointmentDialog", () => ({
  QuickAppointmentDialog: () => null,
}));

vi.mock("@/components/crm/ScheduleBlockDialog", () => ({
  ScheduleBlockDialog: () => null,
}));

vi.mock("@/lib/appointment-api", () => ({
  cancelAppointment: mocks.cancelAppointment,
  getDoctorPendingTimeRequests: vi.fn(),
  getDoctorMyDayAppointments: vi.fn(),
  updateAppointmentStatus: mocks.updateAppointmentStatus,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        maybeSingle: mocks.statusMaybeSingle,
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    },
  },
}));

import DoctorMyDay from "./DoctorMyDay";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

const timeRequest = {
  id: "request-1",
  patientId: "patient-2",
  patientName: "Patient Request",
  doctorId: "doctor-1",
  doctorName: "Doctor",
  clinicId: "clinic-1",
  clinicName: "Clinic",
  serviceId: null,
  appointmentDate: "2026-07-29",
  startTime: "11:00:00",
  endTime: "11:30:00",
  status: "PENDING",
  notes: null,
  timeRequest: true,
  requestReason: "Need this time",
  totalPrice: null,
  currency: null,
  createdAt: "2026-07-28T08:00:00Z",
};

function renderWithTimeRequest() {
  mocks.timeRequests = [timeRequest];

  render(
    <MemoryRouter>
      <DoctorMyDay />
    </MemoryRouter>,
  );

  return {
    accept: screen.getByRole("button", { name: "doctorMyDay.acceptRequest" }),
    reject: screen.getByRole("button", { name: "doctorMyDay.rejectRequest" }),
  };
}

describe("DoctorMyDay appointment action lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.timeRequests = [];
    mocks.cancelAppointment.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.updateAppointmentStatus.mockResolvedValue(undefined);
    mocks.statusMaybeSingle.mockResolvedValue({
      data: { status: "CONFIRMED" },
      error: null,
    });
    mocks.useQuery.mockImplementation(({ queryKey }: {
      queryKey: readonly unknown[];
    }) => {
      if (queryKey[0] === "current-doctor") {
        return {
          data: { id: "doctor-1" },
          isLoading: false,
          isError: false,
          isFetching: false,
          refetch: vi.fn(),
        };
      }
      if (queryKey[0] === "current-profile") {
        return { data: { first_name: "Doctor" } };
      }
      if (queryKey[0] === "doctor-time-requests") {
        return {
          data: mocks.timeRequests,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: [{
          id: "appointment-1",
          time: "10:00",
          durMin: 30,
          patientName: "Patient One",
          type: "Consultation",
          status: "next",
          isNew: false,
          patientId: "patient-1",
          rawStart: new Date("2026-07-28T10:00:00+05:00"),
        }],
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
      };
    });
  });

  it("disables the start action and sends only one mutation while it is pending", async () => {
    const update = deferred();
    mocks.updateAppointmentStatus.mockReturnValue(update.promise);

    render(
      <MemoryRouter>
        <DoctorMyDay />
      </MemoryRouter>,
    );

    const start = screen.getByRole("button", { name: "doctorMyDay.start" });
    fireEvent.click(start);
    fireEvent.click(start);

    await waitFor(() => {
      expect(mocks.updateAppointmentStatus).toHaveBeenCalledOnce();
      expect(start).toBeDisabled();
      expect(start).toHaveAttribute("aria-busy", "true");
    });

    update.resolve();
    await waitFor(() => expect(start).not.toBeDisabled());
    expect(mocks.updateAppointmentStatus).toHaveBeenCalledOnce();
  });

  it("accepts a time request and refreshes both affected lists", async () => {
    const { accept } = renderWithTimeRequest();

    fireEvent.click(accept);

    await waitFor(() => {
      expect(mocks.updateAppointmentStatus).toHaveBeenCalledWith({
        appointmentId: "request-1",
        status: "CONFIRMED",
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("doctorMyDay.requestAccepted");
    });
    expect(mocks.cancelAppointment).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["doctor-time-requests", "doctor-1"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["doctor-my-day", "doctor-1"],
    });
  });

  it("rejects a time request with the translated reason and refreshes both lists", async () => {
    const { reject } = renderWithTimeRequest();

    fireEvent.click(reject);

    await waitFor(() => {
      expect(mocks.cancelAppointment).toHaveBeenCalledWith({
        appointmentId: "request-1",
        reason: "doctorMyDay.requestRejectedReason",
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("doctorMyDay.requestRejected");
    });
    expect(mocks.updateAppointmentStatus).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["doctor-time-requests", "doctor-1"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["doctor-my-day", "doctor-1"],
    });
  });

  it("shows the server error and unlocks the actions when accepting fails", async () => {
    mocks.updateAppointmentStatus.mockRejectedValueOnce(new Error("accept failed"));
    const { accept, reject } = renderWithTimeRequest();

    fireEvent.click(accept);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("accept failed"));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(accept).not.toBeDisabled();
    expect(reject).not.toBeDisabled();
  });

  it("shows the server error and unlocks the actions when rejecting fails", async () => {
    mocks.cancelAppointment.mockRejectedValueOnce(new Error("reject failed"));
    const { accept, reject } = renderWithTimeRequest();

    fireEvent.click(reject);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("reject failed"));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(accept).not.toBeDisabled();
    expect(reject).not.toBeDisabled();
  });

  it("locks both request actions and sends only one mutation while it is pending", async () => {
    const update = deferred();
    mocks.updateAppointmentStatus.mockReturnValue(update.promise);
    const { accept, reject } = renderWithTimeRequest();

    fireEvent.click(accept);
    fireEvent.click(accept);
    fireEvent.click(reject);

    await waitFor(() => {
      expect(mocks.updateAppointmentStatus).toHaveBeenCalledOnce();
      expect(mocks.cancelAppointment).not.toHaveBeenCalled();
      expect(accept).toBeDisabled();
      expect(reject).toBeDisabled();
    });

    await act(async () => update.resolve());
    await waitFor(() => {
      expect(accept).not.toBeDisabled();
      expect(reject).not.toBeDisabled();
    });
    expect(mocks.updateAppointmentStatus).toHaveBeenCalledOnce();
  });
});
