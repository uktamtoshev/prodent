import { useQueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createTestQueryClient, render } from "./render";

function ProviderProbe() {
  const location = useLocation();
  const queryClient = useQueryClient();

  return (
    <>
      <p>route:{location.pathname}</p>
      <p>retries:{String(queryClient.getDefaultOptions().queries?.retry)}</p>
    </>
  );
}

describe("test render helper", () => {
  it("provides an isolated query client and requested memory route", () => {
    const queryClient = createTestQueryClient();
    const result = render(<ProviderProbe />, {
      initialEntries: ["/crm/patients"],
      queryClient,
    });

    expect(result.queryClient).toBe(queryClient);
    expect(screen.getByText("route:/crm/patients")).toBeInTheDocument();
    expect(screen.getByText("retries:false")).toBeInTheDocument();
  });

  it("creates a fresh query cache for every render", () => {
    const first = render(<ProviderProbe />);
    const second = render(<ProviderProbe />);

    expect(first.queryClient).not.toBe(second.queryClient);
  });
});
