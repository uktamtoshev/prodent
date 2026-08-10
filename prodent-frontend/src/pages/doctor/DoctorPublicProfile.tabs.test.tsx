import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

import { ProfileTabs } from "./DoctorPublicProfile";

function ProfileTabsHarness({ initialTab }: { initialTab: string }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <>
      <ProfileTabs active={activeTab} onChange={setActiveTab} isOwner />
      <div
        id={`doctor-profile-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`doctor-profile-tab-${activeTab}`}
      >
        {activeTab}
      </div>
    </>
  );
}

describe("DoctorPublicProfile tabs", () => {
  it("exposes services and settings as linked, selectable tabs", async () => {
    const user = userEvent.setup();
    render(<ProfileTabsHarness initialTab="services" />);

    const services = screen.getByRole("tab", {
      name: "doctorPublicProfile.tabServices",
    });
    expect(services).toHaveAttribute("aria-selected", "true");
    expect(services).toHaveAttribute(
      "aria-controls",
      "doctor-profile-panel-services",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      services.id,
    );

    const settings = screen.getByRole("tab", {
      name: "doctorPublicProfile.tabSettings",
    });
    await user.click(settings);

    expect(settings).toHaveAttribute("aria-selected", "true");
    expect(settings).toHaveAttribute(
      "aria-controls",
      "doctor-profile-panel-settings",
    );
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      settings.id,
    );
  });

  it("moves selection and focus across overflow tabs with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ProfileTabsHarness initialTab="services" />);

    const services = screen.getByRole("tab", {
      name: "doctorPublicProfile.tabServices",
    });
    services.focus();
    await user.keyboard("{ArrowRight}");

    const settings = screen.getByRole("tab", {
      name: "doctorPublicProfile.tabSettings",
    });
    expect(settings).toHaveFocus();
    expect(settings).toHaveAttribute("aria-selected", "true");
  });
});
