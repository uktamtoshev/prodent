# Sprint 2 test foundation

## Component tests

Use `src/test/render.tsx` instead of importing `render` directly. It gives each
test a fresh React Query cache, a memory router and the tooltip provider.
Queries and mutations do not retry, so a failed request cannot make a test slow
or random.

Pass `initialEntries` when the component reads the current route:

```tsx
const view = render(<PatientList />, {
  initialEntries: ["/crm/patients"],
});
```

The returned `queryClient` belongs only to that render and can be prefilled or
inspected by the test.

## Deterministic data

`src/test/fixtures.ts` contains frozen users, clinics and appointments. Their
IDs and dates never depend on the current clock, network or database. They use
the reserved `.test` email domain and contain no real patient data.

Do not change shared fixtures inside a test. Add a small local copy when a test
needs a special field.

## Browser reference

`tests/product-e2e/reference-foundation.spec.ts` checks:

- accessibility in light and dark themes and first keyboard focus on `/`;
- the guest guard on `/crm`;
- public visual baselines at 1440 px and 360 px in both themes on Linux only.

Windows screenshots are deliberately skipped. This prevents a Windows image
from being committed as the Linux CI reference.

Create or refresh the canonical image in a Linux CI update job:

```sh
npx playwright test --config playwright.product.config.ts \
  reference-foundation.spec.ts \
  --grep "visual baseline" --update-snapshots
```

Commit only the generated Linux PNG files. Normal CI must run the same test
without `--update-snapshots`.

## Authenticated CRM limitation

The repository has no clinical login secret. Browser tests may only verify that
a guest is redirected from `/crm` to `/auth`.

The future authenticated job must provide a Playwright storage-state file
through `PRODENT_E2E_STORAGE_STATE`. It must use a synthetic clinic account with
role `clinic_admin` or `clinic_owner`, and must not contain real patient data.
The matching source-code contract is `AUTHENTICATED_CRM_FIXTURE_CONTRACT`.
