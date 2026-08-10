import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  return {
    auth: { user: { id: "patient-1" } as { id: string } | null },
    from: vi.fn(() => query),
    query,
    listPatientFiles: vi.fn(),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.auth.user }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/patient/PatientLayout", () => ({
  PatientLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/lib/patient-files-api", () => ({
  listPatientFiles: mocks.listPatientFiles,
}));

import PatientFiles from "./PatientFiles";

describe("PatientFiles loading effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "patient-1" };
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.listPatientFiles.mockResolvedValue({ data: [], error: null });
  });

  it("loads once for a stable patient and reloads once when the patient id changes", async () => {
    const { rerender } = render(<PatientFiles />);

    await waitFor(() => expect(mocks.listPatientFiles).toHaveBeenCalledTimes(1));
    expect(mocks.listPatientFiles).toHaveBeenCalledWith("patient-1");

    mocks.auth.user = { id: "patient-1" };
    rerender(<PatientFiles />);
    await act(async () => undefined);
    expect(mocks.listPatientFiles).toHaveBeenCalledTimes(1);

    mocks.auth.user = { id: "patient-2" };
    rerender(<PatientFiles />);

    await waitFor(() => expect(mocks.listPatientFiles).toHaveBeenCalledTimes(2));
    expect(mocks.listPatientFiles).toHaveBeenLastCalledWith("patient-2");
  });

  it("does not query patient files without an authenticated patient", async () => {
    mocks.auth.user = null;
    render(<PatientFiles />);

    await act(async () => undefined);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("ignores a late response from the previous authenticated patient", async () => {
    const user = userEvent.setup();
    let resolveFirst!: (value: { data: unknown[]; error: null }) => void;
    let resolveSecond!: (value: { data: unknown[]; error: null }) => void;
    mocks.listPatientFiles
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));
    const { rerender } = render(<PatientFiles />);

    await waitFor(() => expect(mocks.listPatientFiles).toHaveBeenCalledTimes(1));
    mocks.auth.user = { id: "patient-2" };
    rerender(<PatientFiles />);
    await waitFor(() => expect(mocks.listPatientFiles).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveSecond({
        data: [{
          id: "new",
          file_url: "/api/v1/storage/documents/patient-2/new.pdf",
          file_type: "document",
          description: null,
          created_at: "2026-07-28T10:00:00Z",
          title: "Новый файл",
        }],
        error: null,
      });
    });
    await user.click(
      screen.getByRole("tab", {
        name: /patientCabinet.filesTabDocuments \(1\)/,
      }),
    );
    expect(await screen.findByText("Новый файл")).toBeInTheDocument();

    await act(async () => {
      resolveFirst({
        data: [{
          id: "old",
          file_url: "/api/v1/storage/documents/patient-1/old.pdf",
          file_type: "document",
          description: null,
          created_at: "2026-07-28T09:00:00Z",
          title: "Старый файл",
        }],
        error: null,
      });
    });
    expect(screen.queryByText("Старый файл")).not.toBeInTheDocument();
    expect(screen.getByText("Новый файл")).toBeInTheDocument();
  });

  it("shows a load error and retries without presenting it as an empty list", async () => {
    mocks.listPatientFiles
      .mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValueOnce({ data: [], error: null });
    render(<PatientFiles />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => expect(mocks.listPatientFiles).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("patientCabinet.myFiles")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
