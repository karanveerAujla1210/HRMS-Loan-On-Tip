// Theme design tokens synchronized 100% with the Loan On Tip HRMS Web Application (app/globals.css)

export const colors = {
  // Brand Terracotta / Coral Palette
  brand: "#e85534",         // --brand: #e85534 (Terracotta Orange)
  brandDark: "#c94420",     // --brand-dark: #c94420
  brandLight: "#fceae5",    // --brand-light: #fceae5

  // Accents & Function Statuses
  accent: "#e85534",        // Primary Accent
  blue: "#3b82f6",          // Electric Blue
  mint: "#10b981",          // Success / Present Green
  amber: "#f59e0b",         // Warning / Late Amber
  rose: "#ef4444",          // Danger / Absent Red
  purple: "#8b5cf6",        // Statutory / Special Purple

  // Canvas & Light Surface Cards (Matching Web App)
  bg: "#f4f5f9",            // --bg: #f4f5f9 Light Canvas
  cardBg: "#ffffff",        // --surface: #ffffff Clean White Card
  cardBgHover: "#fafbfd",   // Soft hover background
  border: "#e8eaf0",        // --border: #e8eaf0
  borderLight: "#f0f2f7",   // --border-light: #f0f2f7

  // Text Colors
  textPrimary: "#1a2236",   // --text: #1a2236 Deep Slate
  textSecondary: "#4a5568", // --text-2: #4a5568
  textMuted: "#8a93a8",     // --text-3: #8a93a8
  textDisabled: "#b0b8cc",  // --text-4: #b0b8cc
  textInverted: "#ffffff",

  // Badge Status Mappings (Matching Web App .pill-* and .badge-*)
  status: {
    PRESENT: { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
    LATE: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    ABSENT: { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
    HALF_DAY: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
    ON_LEAVE: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
    LEAVE: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
    HOLIDAY: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
    WEEKLY_OFF: { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" },
    WORK_FROM_HOME: { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
    PENDING: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    APPROVED: { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
    REJECTED: { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" },
    PAID: { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" },
    ASSIGNED: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
  }
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "rgba(0,0,0,0.12)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
