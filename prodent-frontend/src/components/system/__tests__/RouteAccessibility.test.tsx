import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteAccessibility } from "../RouteAccessibility";

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate("/next")}>
        Next page
      </button>
      <button type="button" onClick={() => navigate("/next#details")}>
        Next section
      </button>
      <div data-testid="location">{`${location.pathname}${location.hash}`}</div>
    </>
  );
}

function TestApp({ dialog = false }: { dialog?: boolean }) {
  return (
    <MemoryRouter initialEntries={["/start"]}>
      <Navigation />
      {dialog ? (
        <div role="dialog" aria-modal="true">
          <button type="button">Close dialog</button>
        </div>
      ) : null}
      <RouteAccessibility />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/start" element={<h1>Start page</h1>} />
          <Route path="/next" element={<h1>Next page heading</h1>} />
        </Routes>
      </main>
    </MemoryRouter>
  );
}

describe("RouteAccessibility", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("announces and focuses the main content after pathname navigation", async () => {
    render(<TestApp />);

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    const main = screen.getByRole("main");
    await waitFor(() => expect(main).toHaveFocus());
    expect(screen.getByRole("status")).toHaveTextContent("Next page heading");
  });

  it("does not steal focus on the initial render", () => {
    render(<TestApp />);

    expect(screen.getByRole("main")).not.toHaveFocus();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("does not move focus when navigation targets a hash", async () => {
    render(<TestApp />);
    const trigger = screen.getByRole("button", { name: "Next section" });
    trigger.focus();

    await userEvent.click(trigger);

    expect(screen.getByTestId("location")).toHaveTextContent("/next#details");
    expect(screen.getByRole("main")).not.toHaveFocus();
  });

  it("does not move focus while a modal dialog is open", async () => {
    render(<TestApp dialog />);

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/next");
    expect(screen.getByRole("main")).not.toHaveFocus();
  });
});
