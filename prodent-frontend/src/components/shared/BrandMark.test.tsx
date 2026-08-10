import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BrandMark } from "./BrandMark";

describe("BrandMark", () => {
  it("renders the name as real text so the brand is readable, not just a glyph", () => {
    render(<BrandMark />);

    expect(screen.getByText("PRODENT")).toBeInTheDocument();
  });

  /**
   * The image used to carry `alt="PRODENT"`. Now that the name is visible text,
   * keeping that alt would make a screen reader announce "PRODENT PRODENT".
   */
  it("marks the tooth image decorative because the wordmark names the product", () => {
    const { container } = render(<BrandMark />);
    const image = container.querySelector("img");

    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("aria-hidden", "true");
    // No accessible image left for a screen reader to find.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses the brand font, not the body font", () => {
    render(<BrandMark />);

    expect(screen.getByText("PRODENT")).toHaveClass("font-heading", "font-bold", "uppercase");
  });

  /** The sidebar sits on teal-ink; a foreground token there would be unreadable. */
  it("switches to the sidebar text token on the dark sidebar surface", () => {
    render(<BrandMark tone="sidebar" />);

    expect(screen.getByText("PRODENT")).toHaveClass("text-sidebar-text");
    expect(screen.getByText("PRODENT")).not.toHaveClass("text-foreground");
  });

  it("accepts responsive overrides for the header's three breakpoints", () => {
    const { container } = render(
      <BrandMark size="sm" iconClassName="md:h-12 md:w-12" wordClassName="md:text-2xl" />,
    );

    expect(container.querySelector("img")).toHaveClass("h-8", "w-8", "md:h-12");
    expect(screen.getByText("PRODENT")).toHaveClass("text-lg", "md:text-2xl");
  });
});
