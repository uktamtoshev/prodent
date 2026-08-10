import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageAttachment } from "./MessageAttachment";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  createSignedUrl: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    storage: {
      from: () => ({
        upload: mocks.upload,
        createSignedUrl: mocks.createSignedUrl,
      }),
    },
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe("MessageAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({ error: null });
  });

  it("shows an error and retries when signed URL creation fails", async () => {
    mocks.createSignedUrl
      .mockResolvedValueOnce({ data: null, error: new Error("signed URL failed") })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://files.example/signed" },
        error: null,
      });
    const onFileSelected = vi.fn();
    const { container } = render(
      <MessageAttachment
        onFileSelected={onFileSelected}
        pendingFile={null}
        onClearFile={vi.fn()}
      />,
    );

    const file = new File(["image"], "photo.png", { type: "image/png" });
    const input = container.querySelector('input[accept="image/*"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("signed URL failed");
    expect(onFileSelected).not.toHaveBeenCalled();

    // `t` is mocked to echo the key, so the retry button renders "common.retry".
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    await waitFor(() =>
      expect(onFileSelected).toHaveBeenCalledWith(
        "https://files.example/signed",
        "image",
        "photo.png",
      ),
    );
    expect(mocks.createSignedUrl).toHaveBeenCalledTimes(2);
  });
});
