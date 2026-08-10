import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appointmentsLookup: vi.fn(),
  cancelAppointment: vi.fn(),
  from: vi.fn(),
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "patient-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ru", t: (key: string) => key }),
}));

vi.mock("@/components/patient/PatientLayout", () => ({
  PatientLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

vi.mock("@/lib/appointment-api", () => ({
  cancelAppointment: mocks.cancelAppointment,
  rescheduleAppointment: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

import PatientAppointments from "./PatientAppointments";

function makeAppointmentsQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(() => mocks.appointmentsLookup()),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("PatientAppointments mutation and background sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((table: string) => {
      if (table === "appointments") return makeAppointmentsQuery();
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.cancelAppointment.mockResolvedValue(undefined);
    mocks.appointmentsLookup
      .mockResolvedValueOnce({
        data: [{
          id: "appointment-1",
          appointment_date: "2099-08-10",
          start_time: "14:30:00",
          end_time: "15:15:00",
          status: "CONFIRMED",
          notes: null,
          total_price: 100,
          service_id: null,
          cancel_reason: null,
          cancelled_at: null,
          confirmed_at: null,
          completed_at: null,
          created_at: "2026-07-28T10:00:00Z",
          service: { name_ru: "Consultation" },
          doctor: {
            id: "doctor-1",
            specialty: "Dentist",
            user_id: null,
          },
          clinic: { name: "Clinic", address: "Address" },
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: new Error("refresh unavailable"),
      });
  });

  it("keeps a successful cancellation when background refresh fails", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PatientAppointments />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", {
      name: "patientCabinet.cancelButton",
    }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Cannot attend");
    await user.click(within(dialog).getByRole("button", {
      name: "patientCabinet.yesCancel",
    }));

    await waitFor(() => {
      expect(mocks.cancelAppointment).toHaveBeenCalledOnce();
      expect(mocks.toast.success).toHaveBeenCalledWith(
        "patientCabinet.appointmentCancelled",
      );
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", {
      name: "patientCabinet.cancelButton",
    })).not.toBeInTheDocument();

    const syncAlert = await screen.findByRole("alert");
    expect(syncAlert).toHaveTextContent("common.error");
    expect(within(syncAlert).getByRole("button", {
      name: "common.retry",
    })).toBeVisible();
    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(mocks.cancelAppointment).toHaveBeenCalledOnce();
  });
});
