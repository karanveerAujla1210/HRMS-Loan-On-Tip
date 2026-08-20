// Design tokens shared between web (CSS vars) and mobile (React Native StyleSheet).

export const colors = {
  brand: "#1a2e4a",
  mint: "#10b981",
  blue: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  navy: "#1e3a5f",
  surface: "#ffffff",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f9fafb",
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 18,
  xl: 24,
  "2xl": 30,
} as const;

export const statusColors: Record<string, string> = {
  present: colors.mint,
  late: colors.amber,
  absent: colors.rose,
  half_day: colors.blue,
  on_leave: colors.muted,
};
