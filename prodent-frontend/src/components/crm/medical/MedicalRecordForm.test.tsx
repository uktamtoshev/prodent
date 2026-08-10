import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: [
      {
        id: "appointment-1",
        clinic_id: "clinic-1",
        appointment_date: "2026-07-28",
        start_time: "10:00:00",
        service: "Осмотр",
        status: "CONFIRMED",
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.success,
    error: mocks.error,
    warning: mocks.warning,
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/calendar", () => ({
  Calendar: () => null,
}));

vi.mock("./VoiceRecorder", () => ({
  VoiceRecorder: () => null,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
  SelectValue: () => <span>appointment-1</span>,
}));

import { MedicalRecordForm } from "./MedicalRecordForm";

describe("MedicalRecordForm", () => {
  it("submits once and does not turn a successful save into failure when refresh throws", async () => {
    let resolveSave!: (value: { error: null }) => void;
    mocks.invoke.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const onSuccess = vi.fn(() => {
      throw new Error("refresh failed");
    });
    const onOpenChange = vi.fn();
    render(
      <MedicalRecordForm
        open
        patientId="patient-1"
        doctorId="doctor-1"
        onSuccess={onSuccess}
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText(/crmMedicalRecordForm.patientComplaints/),
      { target: { value: "Боль" } },
    );
    fireEvent.change(
      screen.getByLabelText(/crmMedicalRecordForm.diagnosis/),
      { target: { value: "Кариес" } },
    );
    const save = screen.getByRole("button", {
      name: /crmMedicalRecordForm.saveRecord/,
    });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    await act(async () => resolveSave({ error: null }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(mocks.warning).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/crmMedicalRecordForm.patientComplaints/)).toHaveValue("");
  });
});
