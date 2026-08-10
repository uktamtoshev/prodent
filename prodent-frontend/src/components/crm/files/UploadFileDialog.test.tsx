import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  insert: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  createPatientFile: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: mocks.getPublicUrl,
      }),
    },
    from: () => ({ insert: mocks.insert }),
  },
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
vi.mock("@/lib/patient-files-api", () => ({
  createPatientFile: mocks.createPatientFile,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children, value }: { children: ReactNode; value: string }) =>
    value === "standard" ? <div>{children}</div> : null,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: { children: ReactNode }) => <button type="button" {...props}>{children}</button>,
  SelectValue: () => <span>xray</span>,
}));

vi.mock("./ResumableUpload", () => ({ ResumableUpload: () => null }));

import { UploadFileDialog } from "./UploadFileDialog";

function renderDialog() {
  const onOpenChange = vi.fn();
  const view = render(
    <UploadFileDialog
      open
      onOpenChange={onOpenChange}
      patientId="patient-1"
      doctorId="doctor-1"
    />,
  );
  const input = view.container.querySelector('#file-upload');
  fireEvent.change(input!, {
    target: { files: [new File(["image"], "xray.png", { type: "image/png" })] },
  });
  return { ...view, onOpenChange };
}

describe("UploadFileDialog private storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({
      data: { path: "patient-1/private-xray.png" },
      error: null,
    });
    mocks.remove.mockResolvedValue({ data: { count: 1 }, error: null });
  });

  it("stores only the private authenticated path and never requests a public URL", async () => {
    mocks.createPatientFile.mockResolvedValue({ data: {}, error: null });
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "crmFileUpload.upload" }));

    await waitFor(() => expect(mocks.createPatientFile).toHaveBeenCalledTimes(1));
    expect(mocks.createPatientFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file_url: "/api/v1/storage/patient-files/patient-1/private-xray.png",
        thumbnail_url: "/api/v1/storage/patient-files/patient-1/private-xray.png",
      }),
    );
    expect(mocks.getPublicUrl).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("removes the private object when metadata insertion fails", async () => {
    mocks.createPatientFile.mockResolvedValue({ error: new Error("db failed") });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "crmFileUpload.upload" }));

    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith([
        "patient-1/private-xray.png",
      ]),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });

  it("warns safely and retries cleanup when remove returns an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createPatientFile.mockResolvedValue({ error: new Error("db failed") });
    mocks.remove.mockResolvedValue({
      data: null,
      error: new Error("patient-1/private-xray.png could not be removed"),
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "crmFileUpload.upload" }));

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Patient file cleanup failed; manual storage cleanup is required.",
      ),
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-xray.png could not be removed",
    );
    expect(mocks.warning).toHaveBeenCalledWith(
      "crmResumableUpload.errorOccurred",
    );
    expect(mocks.warning.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-xray.png",
    );
    expect(mocks.error.mock.calls.flat().join(" ")).not.toContain("db failed");

    mocks.remove.mockResolvedValue({ data: { count: 1 }, error: null });
    fireEvent.click(
      screen.getByRole("button", {
        name: "crmResumableUpload.retry: crmResumableUpload.errorOccurred",
      }),
    );
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    consoleError.mockRestore();
  });

  it("warns safely and offers cleanup retry when remove throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.createPatientFile.mockResolvedValue({ error: new Error("db failed") });
    mocks.remove.mockRejectedValue(
      new Error("patient-1/private-xray.png storage exception"),
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "crmFileUpload.upload" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(mocks.warning).toHaveBeenCalledWith(
      "crmResumableUpload.errorOccurred",
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-xray.png storage exception",
    );
    expect(mocks.warning.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-xray.png",
    );
    expect(mocks.error.mock.calls.flat().join(" ")).not.toContain("db failed");
    expect(
      screen.getByRole("button", {
        name: "crmResumableUpload.retry: crmResumableUpload.errorOccurred",
      }),
    ).toBeEnabled();
    consoleError.mockRestore();
  });
});
