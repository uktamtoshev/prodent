import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("tus-js-client", () => ({
  Upload: class {
    private options: { onSuccess?: () => void | Promise<void> };
    constructor(_file: File, options: { onSuccess?: () => void | Promise<void> }) {
      this.options = options;
    }
    findPreviousUploads() {
      return Promise.resolve([]);
    }
    start() {
      void this.options.onSuccess?.();
    }
    abort() {}
    resumeFromPreviousUpload() {}
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "token" } },
      }),
    },
    storage: {
      from: () => ({ remove: mocks.remove }),
    },
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

import { ResumableUpload } from "./ResumableUpload";

describe("ResumableUpload completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("awaits metadata registration and removes the object when it fails", async () => {
    mocks.remove.mockResolvedValue({ data: { count: 1 }, error: null });
    const onUploadComplete = vi.fn().mockRejectedValue(new Error("db failed"));
    const { container } = render(
      <ResumableUpload
        bucketName="patient-files"
        folderPath="patient-1"
        onUploadComplete={onUploadComplete}
      />,
    );
    const input = container.querySelector('#resumable-upload');
    fireEvent.change(input!, {
      target: { files: [new File(["model"], "model.stl")] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /crmResumableUpload.startUpload/ }),
    );

    await waitFor(() => expect(onUploadComplete).toHaveBeenCalledTimes(1));
    const [privateUrl, objectName] = onUploadComplete.mock.calls[0];
    expect(privateUrl).toBe(`/api/v1/storage/patient-files/${objectName}`);
    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith([objectName]),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(
      "crmResumableUpload.uploadFileError",
    );
  });

  it("warns safely and retries cleanup when remove returns an error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.remove.mockResolvedValue({
      data: null,
      error: new Error("patient-1/private-model.stl could not be removed"),
    });
    const { container } = render(
      <ResumableUpload
        bucketName="patient-files"
        folderPath="patient-1"
        onUploadComplete={vi.fn().mockRejectedValue(new Error("db failed"))}
      />,
    );
    fireEvent.change(container.querySelector('#resumable-upload')!, {
      target: { files: [new File(["model"], "model.stl")] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /crmResumableUpload.startUpload/ }),
    );

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Patient file cleanup failed; manual storage cleanup is required.",
      ),
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-model.stl could not be removed",
    );
    expect(mocks.warning).toHaveBeenCalledWith(
      "crmResumableUpload.errorOccurred",
    );
    expect(mocks.warning.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-model.stl",
    );

    mocks.remove.mockResolvedValue({ data: { count: 1 }, error: null });
    fireEvent.click(
      screen.getByRole("button", {
        name: "crmResumableUpload.retry: crmResumableUpload.errorOccurred",
      }),
    );
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledTimes(2));
    consoleError.mockRestore();
  });

  it("warns safely and offers cleanup retry when remove throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.remove.mockRejectedValue(
      new Error("patient-1/private-model.stl storage exception"),
    );
    const { container } = render(
      <ResumableUpload
        bucketName="patient-files"
        folderPath="patient-1"
        onUploadComplete={vi.fn().mockRejectedValue(new Error("db failed"))}
      />,
    );
    fireEvent.change(container.querySelector('#resumable-upload')!, {
      target: { files: [new File(["model"], "model.stl")] },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /crmResumableUpload.startUpload/ }),
    );

    await waitFor(() =>
      expect(mocks.warning).toHaveBeenCalledWith(
        "crmResumableUpload.errorOccurred",
      ),
    );
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-model.stl storage exception",
    );
    expect(mocks.warning.mock.calls.flat().join(" ")).not.toContain(
      "patient-1/private-model.stl",
    );
    expect(
      screen.getByRole("button", {
        name: "crmResumableUpload.retry: crmResumableUpload.errorOccurred",
      }),
    ).toBeEnabled();
    consoleError.mockRestore();
  });
});
