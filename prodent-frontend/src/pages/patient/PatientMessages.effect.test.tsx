import type { ReactNode } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const result = { data: [] };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    then: vi.fn(
      (
        onFulfilled: (value: typeof result) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);

  const channels: unknown[] = [];
  const channel = vi.fn(() => {
    const instance = {
      on: vi.fn(),
      subscribe: vi.fn(),
    };
    instance.on.mockReturnValue(instance);
    instance.subscribe.mockReturnValue(instance);
    channels.push(instance);
    return instance;
  });

  return {
    auth: { user: { id: "patient-1" } as { id: string } | null },
    channels,
    channel,
    from: vi.fn(() => query),
    query,
    removeChannel: vi.fn(),
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

vi.mock("@/hooks/useMedicalAccess", () => ({
  usePatientAccessRequests: () => ({ data: [] }),
}));

vi.mock("@/components/crm/messages/MessageAttachment", () => ({
  MessageAttachment: () => null,
  MessageFileDisplay: () => null,
  MessageFilePreview: () => null,
}));

vi.mock("@/components/medical/PatientAccessRequestMessage", () => ({
  PatientAccessRequestMessage: () => null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channel,
    from: mocks.from,
    removeChannel: mocks.removeChannel,
  },
}));

import PatientMessages from "./PatientMessages";

describe("PatientMessages effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.user = { id: "patient-1" };
    mocks.channels.length = 0;
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
  });

  it("does not reload or resubscribe for the same patient id", async () => {
    const { rerender, unmount } = render(<PatientMessages />);

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(3));
    expect(mocks.channel).toHaveBeenCalledTimes(2);

    mocks.auth.user = { id: "patient-1" };
    rerender(<PatientMessages />);
    await act(async () => undefined);

    expect(mocks.from).toHaveBeenCalledTimes(3);
    expect(mocks.channel).toHaveBeenCalledTimes(2);
    expect(mocks.removeChannel).not.toHaveBeenCalled();

    mocks.auth.user = { id: "patient-2" };
    rerender(<PatientMessages />);

    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(6));
    expect(mocks.channel).toHaveBeenCalledTimes(4);
    expect(mocks.removeChannel).toHaveBeenCalledTimes(2);

    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(4);
  });
});
