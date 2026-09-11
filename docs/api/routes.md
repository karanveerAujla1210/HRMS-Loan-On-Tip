# API routes

The deployed Next.js BFF routes live under `apps/web/app/api/`. Every response
uses the envelope below. New route families should use a versioned `/api/v1/`
namespace only as part of a coordinated client migration; do not duplicate a
handler under both paths.

```json
{ "data": {}, "error": null, "requestId": "uuid" }
```

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/attendance/check-in` | employee | Validate geo/shift, create check-in |
| POST | `/api/attendance/check-out` | employee | Record check-out and worked duration |
| GET | `/api/attendance` | employee/manager | Own or team calendar (`?from&to`) |
| POST | `/api/leaves` | employee | Submit leave request |
| PATCH | `/api/leaves/:id` | manager/hr_admin | Approve or reject |
| GET/POST | `/api/employees` | hr_admin | Directory and onboarding |
| GET/POST | `/api/assets` | asset_admin | Inventory and asset detail |
| POST | `/api/assets/:id/assign` | asset_admin | Assign or recover asset |
| POST | `/api/payroll/runs` | finance | Create calculated draft payroll |
| PATCH | `/api/payroll/runs/:id` | finance | Approve payroll run |

Error codes: `ATTENDANCE_OUTSIDE_RADIUS`, `ATTENDANCE_DUPLICATE`, `LEAVE_OVERLAP`, `FORBIDDEN`, `VALIDATION_ERROR`.
