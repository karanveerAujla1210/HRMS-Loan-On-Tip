# Employee mobile application

This Expo application is the employee-facing client in the HRMS monorepo.

## Boundaries

- Authentication is performed with Supabase Auth using the publishable key.
- All mutations go through the Next.js BFF at `apps/web/app/api`; never write
  directly to Supabase REST tables from a mobile screen.
- RLS-protected, read-only data may be fetched directly only when an equivalent
  BFF read endpoint does not exist. A screen must never use a direct read to
  infer an authorization decision.
- API request/response schemas and error codes belong in `@hrms/api-contract`.
  Platform UI remains local to this application.

Run it from the repository root with `npm run mobile:start`.
