/* eslint-disable react-refresh/only-export-components -- test utilities intentionally expose a provider-backed render API. */
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";
import {
  render as testingLibraryRender,
  type RenderOptions,
} from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";

const TEST_QUERY_DEFAULTS: DefaultOptions = {
  queries: {
    retry: false,
    gcTime: Number.POSITIVE_INFINITY,
  },
  mutations: {
    retry: false,
  },
};

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: TEST_QUERY_DEFAULTS,
  });
}

export interface TestProviderOptions {
  initialEntries?: readonly string[];
  queryClient?: QueryClient;
}

function TestProviders({
  children,
  initialEntries = ["/"],
  queryClient = createTestQueryClient(),
}: PropsWithChildren<TestProviderOptions>) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter
          initialEntries={[...initialEntries]}
          future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
        >
          {children}
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export interface RenderWithProvidersOptions
  extends Omit<RenderOptions, "wrapper">,
    TestProviderOptions {}

export function render(
  ui: ReactElement,
  {
    initialEntries,
    queryClient,
    ...renderOptions
  }: RenderWithProvidersOptions = {},
) {
  const client = queryClient ?? createTestQueryClient();

  return {
    queryClient: client,
    ...testingLibraryRender(ui, {
      wrapper: ({ children }) => (
        <TestProviders initialEntries={initialEntries} queryClient={client}>
          {children}
        </TestProviders>
      ),
      ...renderOptions,
    }),
  };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
