# Loan On Tip HRMS architecture

This architecture keeps one source of truth in Supabase, uses Next.js as the secure business-API layer, and supports both the admin web application and employee mobile application.

## 1. System shape

```text
                         +-------------------------------+
                         |         Admin web app         |
                         | Next.js App Router, responsive |
                         +---------------+---------------+
                                         | HTTPS
                         +---------------v---------------+
                         |      Next.js API / BFF         |
                         | Auth, validation, roles, rules |
                         +----+--------------+-----------+
                              |              |
                         server key      user JWT / RLS
                              |              |
          +-------------------v--------------v--------------------+
          |                      Supabase                        |
          | Auth | Postgres | RLS | Storage | Realtime | Edge Fn |
          +---+----------+--------------+-------------+----------+
              |          |              |             |
       scheduled jobs  audit logs   realtime events   file uploads
              |          |              |             |
     +--------v----------v--------------v-------------v---------+
     |                   Employee mobile app                    |
     | React Native / Expo: attendance, leave, assets, payslips |
     +----------------------------------------------------------+
```

## 2. Responsibilities

| Layer | Responsibility |
|---|---|
| Web app | HR/admin experience: people, approvals, payroll runs, reports, asset inventory and configuration. |
| Mobile app | Employee self-service: sign in, check in/out, leave requests, attendance history, assets and payslips. |
| Next.js backend (BFF) | Validates request bodies, checks roles, applies attendance/payroll business rules, creates audit records and exposes safe API responses. |
| Supabase Auth | OTP/password/SSO session issuance and refresh-token management. |
| Postgres + RLS | Canonical HRMS data and row-level authorization. No client can query data outside its role. |
| Supabase Storage | Employment documents, asset handover records and generated payslip PDFs, accessed through short-lived signed URLs. |
| Realtime | Pushes safe database changes to relevant web and mobile clients. |
| Edge Functions / scheduled jobs | Daily attendance close, absent creation, reminders, payroll calculation and notifications. |

## 3. Data ownership and security

```text
Browser / mobile client
  ├─ Supabase Auth: sign-in, token refresh, session state
  ├─ Read-only, RLS-protected queries: own profile, own attendance,
  │  own leave requests, own assets and own payslips
  └─ Next.js API: every privileged or business-rule write

Next.js server only
  ├─ Supabase service-role client (never bundled to a client)
  ├─ Role and company/location authorization
  ├─ Zod/request validation and rate limiting
  └─ Audit log for every sensitive write or approval
```

Environment variables are separated by trust level:

| Variable | Location | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Web/mobile client and server | Public project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web/mobile client and server | Public publishable key; permissions are limited by RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js server and Edge Functions only | Privileged operations. Never use `NEXT_PUBLIC_` for it. |
| Notification, map and payroll provider keys | Server/Edge Functions only | Third-party integration secrets. |

## 4. API boundary

The frontend should not write directly to sensitive tables. It calls versioned Next.js route handlers; handlers use the authenticated user ID, validate the payload, enforce roles, write the transaction, then add `audit_logs`.

| Client action | API route | Backend action |
|---|---|---|
| Check in | `POST /api/v1/attendance/check-in` | Validate shift, location accuracy/radius and duplicate check-in; upsert attendance and record an exception when required. |
| Check out | `POST /api/v1/attendance/check-out` | Record time/location, calculate duration and queue exception review when applicable. |
| Request leave | `POST /api/v1/leaves` | Validate balance/dates, create pending request and notify manager. |
| Approve leave | `PATCH /api/v1/leaves/:id` | Ensure manager/admin authority, update request and create audit event. |
| Create/update employee | `POST`/`PATCH /api/v1/employees` | HR-only validation, profile changes, documents and onboarding workflow. |
| Assign/return asset | `POST /api/v1/assets/:id/assign` | Verify asset status and atomically update assignment/inventory. |
| Create/approve payroll | `POST /api/v1/payroll/runs` and `PATCH /api/v1/payroll/runs/:id` | Calculate immutable payslip breakdowns and enforce finance approval separation. |

All responses follow one predictable envelope:

```json
{ "data": {}, "error": null, "requestId": "uuid" }
```

On validation or authorization failure, return a stable error code such as `ATTENDANCE_OUTSIDE_RADIUS`, `FORBIDDEN`, or `LEAVE_OVERLAP` so both web and mobile can render the same message.

## 5. Synchronization model

Supabase Postgres is the canonical source. A successful write is committed before any client refreshes, so a device never treats local state as final.

```text
1. Client performs an action (for example, check-in).
2. Client saves an optimistic "syncing" item locally with an idempotency key.
3. Next.js validates and commits a single database transaction.
4. API returns the committed record and version/update timestamp.
5. Realtime publishes the relevant table change.
6. Web and mobile clients merge the new record into their local cache.
7. A reconnecting client refetches changed date ranges to reconcile missed events.
```

### Realtime subscriptions

| Audience | Subscription scope |
|---|---|
| Employee | Their profile, attendance, leave requests, assignments and payslips only. |
| Manager | Direct-report attendance/leave records, scoped by RLS and server-issued queries. |
| HR/admin | Dashboard summaries and selected operational tables, filtered by company/location. |

Do not subscribe every client to whole tables. Use filtered channels, invalidate cached summaries after events, and refetch paginated data as needed.

### Offline mobile behavior

The mobile app stores a small encrypted local queue for attendance and leave actions. Each queued action includes an idempotency key, local timestamp, coordinates/accuracy (for attendance), retry count and status.

- Show **Pending sync** until the server confirms the record.
- Retry on connectivity restoration with exponential backoff.
- The server deduplicates by employee, work date and idempotency key.
- Server time is authoritative. Clock conflicts create a reviewable attendance exception instead of silently overwriting data.
- Do not allow offline payroll approvals, asset handovers or role changes.

## 6. Core workflows

### Attendance

```text
Mobile -> Authenticated API -> validate geo/shift -> attendance transaction
       <- committed status / exception -------------------------------
       -> realtime attendance event -> manager/admin dashboard refresh

Scheduled daily close -> mark unresolved employees absent -> audit + notifications
```

Location is captured only at check-in/out. The mobile client requests foreground permission at the moment of action; it must not do continuous tracking for the MVP.

### Payroll

```text
HR approves attendance and leave
  -> payroll run is created
  -> server/Edge Function calculates payslip drafts from approved data
  -> finance reviews and approves
  -> immutable payslip JSON + PDF stored in Storage
  -> employee receives notification and accesses a signed download URL
```

Payroll calculations must be versioned. Once approved, preserve the exact inputs and breakdown; later salary edits must not change historic payslips.

### Documents and assets

The client asks the backend for a short-lived signed upload URL, uploads directly to private Storage, then confirms metadata through an API route. The backend creates the document or asset audit entry. Files are never publicly readable by default.

## 7. Frontend and mobile structure

```text
apps/
  web/                 Next.js web/admin app
    app/(dashboard)/   pages and route handlers
    components/        presentational components
    features/          people, attendance, leave, payroll, assets
  mobile/              Expo / React Native employee app
    screens/           authentication and employee self-service flows
    services/          API client, auth, realtime, offline queue
packages/
  api-contract/        shared request/response types and Zod schemas
  domain/              status labels, permissions and pure calculations
  ui-tokens/           colours, typography and spacing tokens
```

Keep UI components platform-specific, but share domain types, validation schemas, API error codes and design tokens. This prevents web and mobile from drifting while retaining native mobile interaction patterns.

## 8. Delivery order

1. Foundation: Supabase project, migrations, RLS policies, auth, role bootstrap, audit helper and shared API contract.
2. People and access: employee directory/profile, manager relationships, document uploads and admin dashboard data.
3. Attendance and leave: mobile check-in/out with offline queue, exception review, leave workflow and daily close job.
4. Assets: inventory, assignments, return workflow and reminders.
5. Payroll: salary structures, pay-run calculation, approval workflow, payslips and exports.
6. Operations: reports, notifications, observability, rate limits, backups, security review and UAT.

## 9. Definition of a synced, production-ready feature

A feature is complete only when it has: a database migration; RLS policy; API schema and authorization; audit event; web UI; mobile UI where employees need it; loading/empty/error states; realtime or refetch reconciliation; offline rules; and automated tests for its business rules.
