# API routes

All routes live under `apps/web/app/api/v1/`. Every response uses the envelope:

```json
{ "data": {}, "error": null, "requestId": "uuid" }
```

| Method | Route | Role | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/attendance/check-in` | employee | Validate geo/shift, create check-in |
| POST | `/api/v1/attendance/check-out` | employee | Record check-out and worked duration |
| GET | `/api/v1/attendance` | employee/manager | Own or team calendar (`?from&to`) |
| POST | `/api/v1/leaves` | employee | Submit leave request |
| PATCH | `/api/v1/leaves/:id` | manager/hr_admin | Approve or reject |
| GET/POST | `/api/v1/employees` | hr_admin | Directory and onboarding |
| GET/POST | `/api/v1/assets` | asset_admin | Inventory and asset detail |
| POST | `/api/v1/assets/:id/assign` | asset_admin | Assign or recover asset |
| POST | `/api/v1/payroll/runs` | finance | Create calculated draft payroll |
| PATCH | `/api/v1/payroll/runs/:id` | finance | Approve payroll run |

Error codes: `ATTENDANCE_OUTSIDE_RADIUS`, `ATTENDANCE_DUPLICATE`, `LEAVE_OVERLAP`, `FORBIDDEN`, `VALIDATION_ERROR`.
