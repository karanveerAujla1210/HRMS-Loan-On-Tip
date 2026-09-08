/**
 * Central registry of every API endpoint string used by the web app.
 *
 * Pages must import paths from here instead of hard-coding `/api/...`
 * literals so that route changes only ever need to happen in one place.
 */
export const API = {
  assets: {
    create: "/api/assets",
    list: "/api/assets/list",
    import: "/api/assets/import",
    assign: (id: string) => `/api/assets/${id}/assign`,
    return: (id: string) => `/api/assets/${id}/return`,
    repair: (id: string) => `/api/assets/${id}/repair`,
    maintenance: "/api/assets/maintenance",
    maintenanceComplete: (id: string) => `/api/assets/maintenance/${id}`,
  },
  attendance: {
    bulkMark: "/api/attendance/bulk-mark",
    checkIn: "/api/attendance/check-in",
    checkOut: "/api/attendance/check-out",
    correction: "/api/attendance/correction",
    exceptions: {
      resolve: (id: string) => `/api/attendance/exceptions/${id}`,
    },
  },
  dashboard: {
    metrics: "/api/dashboard/metrics",
  },
  employees: {
    create: "/api/employees",
    update: (id: string) => `/api/employees/${id}`,
    generateLogin: (id: string) => `/api/employees/${id}/generate-login`,
    import: "/api/people/import",
  },
  expenses: {
    create: "/api/expenses",
    list: "/api/expenses/list",
  },
  helpdesk: {
    create: "/api/helpdesk",
  },
  leaves: {
    create: "/api/leaves",
    balance: "/api/leaves/balance",
    action: (id: string) => `/api/leaves/${id}`,
  },
  organisation: {
    row: (tab: string, id: string) => `/api/organisation/${tab}/${id}`,
  },
  payroll: {
    calculate: "/api/payroll/calculate",
    runs: "/api/payroll/runs",
    run: (id: string) => `/api/payroll/runs/${id}`,
    payslips: "/api/payroll/payslips",
  },
  people: {
    documents: (id: string) => `/api/people/${id}/documents`,
    document: (id: string, docId: string) => `/api/people/${id}/documents/${docId}`,
    exit: (id: string) => `/api/people/${id}/exit`,
    salary: (id: string) => `/api/people/${id}/salary`,
  },
  reports: "/api/reports",
  settings: "/api/settings",
  audit: "/api/audit",
} as const;
