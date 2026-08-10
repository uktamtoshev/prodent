import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ClinicProfileTabs } from "./ClinicProfileTabs";

describe("ClinicProfileTabs accessibility", () => {
  it("connects tabs to panels and supports arrow-key focus", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <ClinicProfileTabs
        activeTab="timeline"
        onTabChange={onTabChange}
        isOwner
      />,
    );

    const timelineTab = screen.getByRole("tab", { name: "Публикации" });
    const reelsTab = screen.getByRole("tab", { name: "Рилсы" });

    expect(screen.getByRole("tablist", { name: "Разделы профиля клиники" })).toBeInTheDocument();
    expect(timelineTab).toHaveAttribute("aria-selected", "true");
    expect(timelineTab).toHaveAttribute("aria-controls", "clinic-profile-panel-timeline");
    expect(timelineTab).toHaveClass("min-h-11", "focus-visible:ring-2");

    timelineTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(reelsTab).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onTabChange).toHaveBeenCalledWith("reels");
  });

  it("renders owner sections as real tabs with unique panel controls", () => {
    render(
      <ClinicProfileTabs
        activeTab="settings"
        onTabChange={vi.fn()}
        isOwner
      />,
    );

    const settingsTab = screen.getByRole("tab", { name: "Настройки" });
    expect(settingsTab).toHaveAttribute("id", "clinic-profile-tab-settings");
    expect(settingsTab).toHaveAttribute("aria-selected", "true");
    expect(settingsTab).toHaveAttribute("aria-controls", "clinic-profile-panel-settings");
    expect(settingsTab).toHaveAttribute("tabindex", "0");
    expect(screen.getAllByRole("tab")).toHaveLength(9);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
