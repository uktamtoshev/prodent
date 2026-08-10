# PRODENT Design System v1

Status: active
Owner: frontend team
Accessibility owners: designer and QA until a permanent owner is assigned
Standard: WCAG 2.2 AA

## Sources of truth

PRODENT uses two synchronized sources:

1. Figma defines approved visual intent and responsive layouts.
2. Code defines the exact runtime tokens, component behavior and accessibility.

When they differ, the difference must be reviewed. Code is not silently changed
to match an old mock-up, and Figma is not silently treated as implemented.

Runtime sources:

- `src/index.css` — semantic light/dark color, shadow and motion tokens.
- `tailwind.config.ts` — typography, spacing, radius and utility mapping.
- `src/components/ui` — base shadcn/Radix primitives.
- `src/components/system` — PRODENT page-level components and states.

The legacy `src/components/design` layer is not a source of truth. New work must
not add dependencies on it because several components use fixed light colors.

## Product constraints

| Area | Target |
|---|---|
| Primary public device | Low/mid Android on mobile 4G |
| Primary cabinet device | Desktop, with all main actions available on mobile |
| Public LCP, p75 | ≤ 2.0 s |
| Cabinet LCP, p75 | ≤ 2.5 s |
| INP, p75 | ≤ 200 ms |
| CLS | ≤ 0.1 |
| Initial JS, gzip | Public ≤ 200 KB; cabinet ≤ 250 KB |
| Route JS, gzip | Public ≤ 100 KB; cabinet ≤ 120 KB |
| Lighthouse accessibility | ≥ 95 |
| Lighthouse performance | Public ≥ 90; cabinet ≥ 85 |

## Tokens

Only semantic tokens are allowed in shared components.

### Color

- Surfaces: `background`, `card`, `popover`, `muted`.
- Text: `foreground`, `card-foreground`, `muted-foreground`.
- Actions: `primary`, `secondary`, `accent`, `destructive`.
- Structure and focus: `border`, `input`, `ring`.
- Brand scale: `brand`, `brand-50`, `brand-100`, `brand-700`.
- Role navigation: the `sidebar-*` token family.

Shared components must support `.dark` without fixed `white`, `black`,
`slate-*`, `red-*` or similar page-specific colors.

### Typography

- Body: Inter Variable, 14 px / 1.5.
- Headings: Manrope, weight 700, letter spacing `-0.01em`.
- Minimum product text: 12 px.
- Numeric tables and totals use tabular numerals.

### Spacing and size

Use Tailwind's 4 px spacing scale. Main touch targets are at least 44×44 px;
the standard PRODENT control height is 48 px.

### Radius

- Cards: `rounded-prodent` (14 px).
- Buttons: `rounded-prodent-btn` (12 px).
- Inputs: `rounded-prodent-input` (10 px).

### Shadow

Use `shadow-card`, `shadow-soft`, `shadow-medium`, `shadow-strong` or
`shadow-glass`. Shared components do not create new one-off shadows.

### Motion

- Fast feedback: 150 ms.
- Standard state change: 250 ms.
- Decorative bounce: 400 ms maximum.
- Motion must respect `prefers-reduced-motion`.
- Motion must never be the only way a state is communicated.

## Component layers

1. `components/ui`: small accessible primitives.
2. `components/system`: reusable page structure, data display, input and state
   patterns.
3. Domain components: business behavior for CRM, doctor, patient, marketplace
   and other modules.

Role checks, clinic scope and database writes stay in the domain layer. A shared
visual shell must never weaken a role guard.

## Required states

Every data surface must have loading, empty, error and permission behavior.
Network-dependent actions also need an offline state. Errors must offer a retry
when retry is safe. Destructive actions use `ConfirmDialog`.

## System component catalog

| Component | Purpose |
|---|---|
| `AppShell` | Semantic header/sidebar/main frame without business guards |
| `PageHeader` | One page title, description and primary actions |
| `FilterBar` | Labeled search, filters, clear and action area |
| `DataTable` | Typed rows, client/server pagination and mobile row rendering |
| `StatCard` | One metric with optional hint, icon and trend |
| `EmptyState` | No data or no filtered result |
| `ErrorState` | Failed load with an optional safe retry |
| `PermissionState` | Authenticated user lacks permission |
| `OfflineState` | Network is unavailable |
| `SkeletonComposition` | Accessible page/card/table loading placeholder |
| `PhoneInput` | Telephone input with mobile keyboard hints |
| `MoneyInput` | Bounded decimal money entry |
| `DateInput` / `TimeInput` | Native accessible date/time entry |
| `ConfirmDialog` | Confirmation for destructive or costly actions |
| `ActionToaster` / `actionToast` | Consistent success and failure feedback |
| `Timeline` | Ordered domain events |
| `Stepper` | Current/completed/upcoming process steps |
| `MobileActionBar` | Safe-area-aware actions on small screens |

## Reference routes

- Public reference: `/` — real public statistics, responsive navigation,
  light/dark theme and keyboard flow.
- CRM reference: `/crm/patients` — real clinic data, filtering, states and a
  create/invite action that writes through the existing backend contract.

These routes are the first consumers used to validate new system components.
They do not grant permission to replace role guards or mock production data.

## Change process

1. Add or update an acceptance test.
2. Change tokens or a system component.
3. Run component tests, typecheck and build.
4. Run public and protected-route smoke tests.
5. Run axe and visual checks at mobile and desktop widths.
6. Record intentional visual changes with designer approval.
