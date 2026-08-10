import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PatientPaymentsPage from "./PatientPaymentsPage";

const context = vi.hoisted(() => ({
  userId: "patient-a",
  noteLoads: new Map<string, Promise<unknown>>(),
}));
const billing = vi.hoisted(() => ({
  getPatientBillingHistory: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: context.userId ? { id: context.userId } : null }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  tGlobal: (key: string) => (key === "apiMessages.currencySum" ? "UZS" : key),
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock("@/components/patient/PatientLayout", () => ({
  PatientLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/patient/AddPaymentNoteDialog", () => ({
  AddPaymentNoteDialog: () => null,
}));
vi.mock("@/lib/patient-billing-api", () => billing);
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let patientId = "";
      const builder = {
        select: () => builder,
        eq: (_column: string, value: string) => {
          patientId = value;
          return builder;
        },
        order: () => context.noteLoads.get(patientId),
      };
      return builder;
    },
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const emptyBilling = { invoices: [], payments: [] };
const note = (id: string, clinicName: string) => ({
  id,
  patient_id: id,
  type: "payment",
  amount: 100,
  clinic_name: clinicName,
  description: null,
  date: "2026-07-28",
  is_resolved: false,
  created_at: "2026-07-28T00:00:00Z",
  updated_at: "2026-07-28T00:00:00Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  context.userId = "patient-a";
  context.noteLoads.clear();
});

describe("PatientPaymentsPage account isolation", () => {
  it("does not let a late patient A response overwrite patient B", async () => {
    const billingA = deferred<typeof emptyBilling>();
    const notesA = deferred<{ data: ReturnType<typeof note>[]; error: null }>();
    billing.getPatientBillingHistory
      .mockImplementationOnce(() => billingA.promise)
      .mockResolvedValueOnce(emptyBilling);
    context.noteLoads.set("patient-a", notesA.promise);
    context.noteLoads.set(
      "patient-b",
      Promise.resolve({ data: [note("note-b", "Clinic B")], error: null }),
    );

    const view = render(<PatientPaymentsPage />);
    context.userId = "patient-b";
    view.rerender(<PatientPaymentsPage />);

    expect(await screen.findByText("Clinic B")).toBeInTheDocument();

    await act(async () => {
      billingA.resolve(emptyBilling);
      notesA.resolve({ data: [note("note-a", "Clinic A")], error: null });
      await Promise.all([billingA.promise, notesA.promise]);
    });

    expect(screen.getByText("Clinic B")).toBeInTheDocument();
    expect(screen.queryByText("Clinic A")).not.toBeInTheDocument();
  });
});
