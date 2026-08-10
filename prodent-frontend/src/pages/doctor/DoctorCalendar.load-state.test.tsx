import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  appointmentsLookup: vi.fn(),
  appointmentsOrder: vi.fn(),
  appointmentsSelect: vi.fn(),
  doctorLookup: vi.fn(),
  from: vi.fn(),
  profilesLookup: vi.fn(),
  t: (key: string) => key,
  user: { id: "doctor-user-1" } as { id: string } | null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: mocks.t }),
}));

vi.mock("@/components/doctor/DoctorLayout", () => ({
  DoctorLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/doctor/DoctorTopbar", () => ({
  DoctorTopbar: () => null,
}));

vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import DoctorCalendar from "./DoctorCalendar";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function makeDoctorQuery() {
  let userId = "";
  const query = {
    select: vi.fn(),
    eq: vi.fn((field: string, value: string) => {
      if (field === "user_id") userId = value;
      return query;
    }),
    maybeSingle: vi.fn(() => mocks.doctorLookup(userId)),
  };
  query.select.mockReturnValue(query);
  return query;
}

function makeAppointmentsQuery() {
  let doctorId = "";
  const query = {
    select: mocks.appointmentsSelect,
    eq: vi.fn((field: string, value: string) => {
      if (field === "doctor_id") doctorId = value;
      return query;
    }),
    order: vi.fn((field: string, options: { ascending: boolean }) => {
      mocks.appointmentsOrder(field, options);
      return mocks.appointmentsLookup(doctorId);
    }),
  };
  mocks.appointmentsSelect.mockReturnValue(query);
  return query;
}

function makeProfilesQuery() {
  const query = {
    select: vi.fn(),
    in: vi.fn((_field: string, ids: string[]) => mocks.profilesLookup(ids)),
  };
  query.select.mockReturnValue(query);
  return query;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DoctorCalendar />
    </MemoryRouter>,
  );
}

describe("DoctorCalendar load safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = { id: "doctor-user-1" };
    mocks.from.mockImplementation((table: string) => {
      if (table === "doctors") return makeDoctorQuery();
      if (table === "appointments") return makeAppointmentsQuery();
      if (table === "profiles") return makeProfilesQuery();
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.doctorLookup.mockResolvedValue({
      data: { id: "doctor-1" },
      error: null,
    });
    mocks.appointmentsLookup.mockResolvedValue({ data: [], error: null });
    mocks.profilesLookup.mockResolvedValue({ data: [], error: null });
  });

  it("shows an appointment GET error and retries it", async () => {
    const user = userEvent.setup();
    mocks.appointmentsLookup
      .mockResolvedValueOnce({
        data: null,
        error: new Error("appointments unavailable"),
      })
      .mockResolvedValueOnce({ data: [], error: null });

    renderPage();

    const retry = await screen.findByRole("button", { name: "common.retry" });
    const alert = retry.closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(within(alert!).getByText("common.error")).toBeVisible();
    expect(retry).toHaveClass("min-h-11");
    await user.click(retry);

    await waitFor(() => expect(mocks.appointmentsLookup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(
      "doctorCalendar.noAppointmentsToday",
    )).toBeVisible());
  });

  it("ignores a stale doctor response after the authenticated user changes", async () => {
    const oldDoctor = deferred<{
      data: { id: string } | null;
      error: Error | null;
    }>();
    mocks.user = { id: "old-user" };
    mocks.doctorLookup.mockImplementation((userId: string) => {
      if (userId === "old-user") return oldDoctor.promise;
      return Promise.resolve({ data: null, error: null });
    });

    const view = renderPage();
    await waitFor(() => expect(mocks.doctorLookup).toHaveBeenCalledWith("old-user"));

    mocks.user = { id: "new-user" };
    view.rerender(
      <MemoryRouter>
        <DoctorCalendar />
      </MemoryRouter>,
    );
    await waitFor(() => expect(mocks.doctorLookup).toHaveBeenCalledWith("new-user"));

    oldDoctor.resolve({ data: { id: "stale-doctor" }, error: null });

    await waitFor(() => expect(screen.getByText(
      "doctorCalendar.noAppointmentsToday",
    )).toBeVisible());
    await waitFor(() => expect(mocks.appointmentsLookup).not.toHaveBeenCalled());
  });

  it("renders the real 14:30 start and 45-minute duration from TIME fields", async () => {
    mocks.appointmentsLookup.mockResolvedValue({
      data: [{
        id: "appointment-1430",
        appointment_date: "2026-07-28",
        start_time: "14:30:00",
        end_time: "15:15:00",
        service: "Consultation",
        status: "CONFIRMED",
        notes: null,
        patient_id: "patient-1",
      }],
      error: null,
    });
    mocks.profilesLookup.mockResolvedValue({
      data: [{ id: "patient-1", full_name: "Patient One" }],
      error: null,
    });

    renderPage();

    expect((await screen.findAllByText("14:30")).length).toBeGreaterThan(0);
    expect(screen.getByText("45 doctor.min")).toBeVisible();
    expect(mocks.appointmentsSelect).toHaveBeenCalledWith(
      expect.stringContaining("start_time, end_time"),
    );
    expect(mocks.appointmentsOrder).toHaveBeenCalledWith(
      "start_time",
      { ascending: true },
    );
  });
});
