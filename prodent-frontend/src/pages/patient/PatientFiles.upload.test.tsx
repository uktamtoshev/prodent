import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return {
    query,
    upload: vi.fn(),
    remove: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    listPatientFiles: vi.fn(),
    createPatientFile: vi.fn(),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "patient-1" } }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/patient/PatientLayout", () => ({
  PatientLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => mocks.query,
    storage: {
      from: () => ({ upload: mocks.upload, remove: mocks.remove }),
    },
  },
}));

vi.mock("@/lib/patient-cabinet", () => ({
  openPrivatePatientFile: vi.fn(),
}));
vi.mock("@/lib/patient-files-api", () => ({
  listPatientFiles: mocks.listPatientFiles,
  createPatientFile: mocks.createPatientFile,
}));

import PatientFiles from "./PatientFiles";

describe("PatientFiles upload", () => {
  it("blocks a duplicate and keeps success when the following refresh fails", async () => {
    let resolveUpload!: (value: { data: { path: string }; error: null }) => void;
    mocks.listPatientFiles
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error("refresh failed") });
    mocks.createPatientFile.mockResolvedValue({ data: {}, error: null });
    mocks.upload.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const { container } = render(<PatientFiles />);

    await screen.findByText("patientCabinet.myFiles");
    const input = container.querySelector('input[type="file"]');
    const file = new File(["pdf"], "record.pdf", { type: "application/pdf" });
    fireEvent.change(input!, { target: { files: [file] } });
    fireEvent.change(input!, { target: { files: [file] } });
    expect(mocks.upload).toHaveBeenCalledTimes(1);

    await act(async () =>
      resolveUpload({ data: { path: "patient-1/record.pdf" }, error: null }),
    );
    await waitFor(() => expect(mocks.createPatientFile).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(mocks.success).toHaveBeenCalledWith("patientCabinet.fileUploaded");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
