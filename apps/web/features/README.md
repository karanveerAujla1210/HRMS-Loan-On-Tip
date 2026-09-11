# Frontend Architecture

Feature-based organization on top of the Next.js App Router. Routes stay thin;
business logic lives in features.

```
apps/web/
├── app/                  # Routes ONLY — thin pages that compose features
│   ├── (app)/            #   protected pages (see docs/architecture/db-domain-mapping.md)
│   ├── (auth)/           #   login
│   └── api/              #   Next.js API routes (privileged writes live here)
├── components/           # Shared, feature-agnostic UI (DataTable, Modal, Form, …)
├── features/             # Feature-based organization — ONE folder per business domain
│   ├── attendance/       #   queries.ts + components/
│   ├── assets/
│   ├── documents/
│   ├── employees/        #   (people, salary, exit, import)
│   ├── leave/
│   ├── notifications/
│   ├── organization/     #   departments, locations, designations, shifts, holidays…
│   ├── payroll/
│   ├── reports/
│   └── self-service/     #   employee-facing panels (my leave, my payslips…)
├── hooks/                # Cross-feature React hooks (useProfile)
├── lib/                  # Infrastructure: supabase client, api client + endpoints, server helpers
├── utils/                # Pure helpers (date, csv…) — no React, no Supabase
└── packages/*            # Monorepo shared code (@hrms/api-contract, domain, config, ui-tokens)
```

## Conventions

1. **Routes are thin.** `app/**/page.tsx` composes feature components; it must not
   contain business logic or inline Supabase queries when a feature module exists.
2. **Supabase reads live in `features/<domain>/queries.ts`.** One function per
   query, exported and named after what it returns. Pages and panels call these —
   never write the same `.from("...")` chain twice.
3. **Writes go through `/api/*` routes** (see `lib/api/endpoints.ts` for the URL
   registry). Components use `apiFetch`, never hand-rolled `fetch` wrappers.
4. **Identity comes from `useProfile` (`hooks/useProfile.ts`)** — never re-query
   `profiles`/`employee_roles` in a page.
5. **Pure helpers go in `utils/`**, shared UI in `components/`, cross-feature
   hooks in `hooks/`.
6. **Avoid giant files.** If a page grows past ~300 lines, split its tabs/sections
   into `features/<domain>/components/` panels that own their own state.

## Super Admin organization-wide visibility

- `SUPER_ADMIN` is the only role with **all** permissions (see
  `packages/api-contract/src/rbac.ts`); it is also the only role allowed to
  switch organizational context.
- **Context switching** is provided by `hooks/useProfile.setActiveCompany` +
  `components/CompanySwitcher.tsx`. The client persists the selection in
  localStorage for instant reads; the **authoritative** server state is the
  HttpOnly `lot_super_admin_company` cookie, set by `POST
  /api/auth/company-context` and consumed by `lib/server/auth.ts`
  (`ctx.companyId` becomes the switched company for API routes).
- All **direct-Supabase admin pages** should read the organizational context
  by aliasing `const { activeCompanyId: companyId } = useProfile()`; the
  `activeCompanyId` always falls back to the home company for non-admins and
  for Super Admins who have not switched.
- API routes that must see context use the HttpOnly cookie automatically; no
  client-side cookie writes. `components/CompanyContextBanner.tsx` tells the
  Super Admin when they are viewing another organization and that admin writes
  still resolve to the home company.