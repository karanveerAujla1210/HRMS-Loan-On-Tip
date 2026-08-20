# Architecture overview

See `ARCHITECTURE.md` at the repo root for the full system diagram and layer responsibilities.

## Monorepo layout

```
apps/web        Next.js admin + employee web PWA
apps/mobile     Expo / React Native employee app
packages/
  api-contract  Shared request/response types (no runtime deps)
  domain        Status labels, role permissions, pure calculations
  ui-tokens     Design tokens (colors, spacing, typography)
  config        Shared constants (shift times, geo radius, leave types)
supabase/
  migrations/   Postgres schema
  functions/    Edge Functions (daily-close, payroll, notifications)
  seed/         Demo data
docs/           Architecture, API reference, HR policies
```
